import { parseLoginIdentifier } from '@liveconsole-ops/shared';
import type {
  AuthUser,
  LoginResponse,
  PermissionKey,
  SessionDto,
  TokenPair,
} from '@liveconsole-ops/types';
import { randomUUID } from 'node:crypto';

import { env } from '../../config/env.js';
import { ForbiddenError, NotFoundError, UnauthenticatedError } from '../../lib/errors.js';
import {
  accessTokenTtlSeconds,
  refreshTokenTtlSeconds,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../lib/jwt.js';
import { logger } from '../../lib/logger.js';
import { generateToken, hashPassword, hashToken, verifyPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import { getContext, setContextActor } from '../../lib/requestContext.js';
import { recordAudit, recordUpdateAudit } from '../../services/audit.service.js';
import * as repository from './auth.repository.js';
import type { AuthUserRecord } from './auth.repository.js';

/**
 * Authentication policy.
 *
 * Decisions worth stating:
 *  • Refresh tokens are JWTs *and* opaque values: the JWT carries the family id so
 *    a stolen token can be traced, and only the SHA-256 hash is stored, so the
 *    database alone cannot be used to mint sessions.
 *  • Rotation is mandatory: every refresh issues a new token and revokes the old
 *    one. Presenting an already-revoked token revokes the whole family.
 *  • Login failures are counted per account and lock it temporarily, and no
 *    response ever reveals whether an account exists.
 */

const RESET_TOKEN_TTL_MINUTES = 30;

/**
 * Attribute the request to an account before writing an audit row.
 *
 * The auth routes run *outside* `authenticate`, so nothing has filled in the
 * ambient context yet. Without this, a LOGIN or LOGIN_FAILED entry lands with a
 * null `organizationId` and is invisible on the tenant's own audit screen — the
 * two events an administrator most wants to see would be the two that never
 * appear. Permissions are deliberately left empty: this identifies who the
 * request concerns, it does not grant anything.
 */
const attributeTo = (account: { id: string; email: string; organizationId: string }): void => {
  setContextActor(account.id, account.email, account.organizationId);
};

/* ------------------------------------------------------------------ */
/* Mapping                                                             */
/* ------------------------------------------------------------------ */

export const toAuthUser = async (user: AuthUserRecord): Promise<AuthUser> => {
  const organization = await repository.findOrganizationById(user.organizationId);

  const permissions = new Set<PermissionKey>();
  for (const { role } of user.roles) {
    for (const { permission } of role.permissions) {
      permissions.add(permission.key as PermissionKey);
    }
  }

  return {
    id: user.id,
    employeeCode: user.employeeCode,
    fullName: user.fullName,
    email: user.email,
    phone: user.mobile,
    avatarUrl: user.avatarUrl,
    designation: user.designation,
    status: user.status,
    isSuperAdmin: user.isSuperAdmin,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    roles: user.roles.map(({ role }) => ({
      id: role.id,
      name: role.name,
      slug: role.slug,
      isSystem: role.isSystem,
    })),
    permissions: [...permissions].sort(),
    organization: organization
      ? {
          id: organization.id,
          code: organization.code,
          name: organization.name,
          legalName: organization.legalName,
          logoUrl: organization.logoUrl,
          currency: organization.currency,
          timezone: organization.timezone,
          fiscalYearStartMonth: organization.fiscalYearStartMonth,
        }
      : null,
    branchId: user.branchId,
  };
};

/* ------------------------------------------------------------------ */
/* Token issuance                                                      */
/* ------------------------------------------------------------------ */

interface IssueTokensOptions {
  rememberMe: boolean;
  /** Continue an existing rotation family; omitted at login to start a new one. */
  familyId?: string;
}

const issueTokens = async (
  user: { id: string; email: string; tokenVersion: number; isSuperAdmin: boolean },
  roles: string[],
  options: IssueTokensOptions,
): Promise<TokenPair> => {
  const context = getContext();
  const familyId = options.familyId ?? randomUUID();

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    roles,
    isSuperAdmin: user.isSuperAdmin,
    tv: user.tokenVersion,
  });

  const refreshToken = signRefreshToken(
    // `jti` is this token's own id, not the family's: it is what makes two tokens
    // issued in the same second distinguishable, and rotation depends on that.
    { sub: user.id, jti: randomUUID(), fam: familyId, tv: user.tokenVersion },
    options.rememberMe,
  );

  await repository.createRefreshToken({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    familyId,
    expiresAt: new Date(Date.now() + refreshTokenTtlSeconds(options.rememberMe) * 1000),
    userAgent: context?.userAgent ?? null,
    ipAddress: context?.ipAddress ?? null,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: accessTokenTtlSeconds(),
    tokenType: 'Bearer',
  };
};

/* ------------------------------------------------------------------ */
/* Login                                                               */
/* ------------------------------------------------------------------ */

/** Identical message for unknown account and wrong password — no user enumeration. */
const INVALID_CREDENTIALS = 'Those sign-in details are incorrect';

/**
 * Resolve what the user typed into exactly one account.
 *
 * A mobile number that matches two live accounts resolves to none: signing one of
 * them in at random would be worse than failing.
 */
const findAccountByIdentifier = async (identifier: string) => {
  const parsed = parseLoginIdentifier(identifier);

  if (parsed.kind === 'email') return repository.findUserByEmail(parsed.value);

  if (parsed.kind === 'mobile') {
    const matches = await repository.findUsersByMobile(parsed.value);

    if (matches.length > 1) {
      logger.warn(
        { mobile: parsed.value },
        'Sign-in by mobile matched more than one account — rejecting. Deduplicate the number.',
      );
      return null;
    }

    return matches[0] ?? null;
  }

  // Neither a plausible email nor a mobile number: no lookup can match it.
  return null;
};

export const login = async (input: {
  identifier: string;
  password: string;
  rememberMe?: boolean;
}): Promise<LoginResponse> => {
  const record = await findAccountByIdentifier(input.identifier);

  if (!record) {
    // Still spend time hashing, so a missing account is not detectable by timing.
    await verifyPassword(
      input.password,
      '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalid',
    );
    throw new UnauthenticatedError(INVALID_CREDENTIALS);
  }

  if (record.lockedUntil && record.lockedUntil > new Date()) {
    const minutes = Math.ceil((record.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new ForbiddenError(
      `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    );
  }

  attributeTo(record);

  const passwordMatches = await verifyPassword(input.password, record.passwordHash);

  if (!passwordMatches) {
    const attempts = record.failedLoginAttempts + 1;
    const shouldLock = attempts >= env.LOGIN_MAX_ATTEMPTS;
    await repository.registerFailedLogin(
      record.id,
      shouldLock ? new Date(Date.now() + env.LOGIN_LOCK_MINUTES * 60_000) : null,
    );

    await recordAudit({
      action: 'LOGIN_FAILED',
      entityType: 'User',
      entityId: record.id,
      entityLabel: record.email,
    });

    throw new UnauthenticatedError(INVALID_CREDENTIALS);
  }

  if (!record.isActive || record.deletedAt || record.status === 'DISABLED') {
    throw new ForbiddenError('This account has been disabled. Contact your administrator.');
  }
  if (record.status === 'SUSPENDED') {
    throw new ForbiddenError('This account is suspended. Contact your administrator.');
  }

  const context = getContext();
  await repository.registerSuccessfulLogin(
    record.id,
    context?.ipAddress ?? null,
    record.status === 'INVITED',
  );

  const tokens = await issueTokens(
    {
      id: record.id,
      email: record.email,
      tokenVersion: record.tokenVersion,
      isSuperAdmin: record.isSuperAdmin,
    },
    record.roles.map(({ role }) => role.slug),
    { rememberMe: input.rememberMe ?? false },
  );

  await recordAudit({
    action: 'LOGIN',
    entityType: 'User',
    entityId: record.id,
    entityLabel: record.email,
  });

  const fresh = await repository.findUserById(record.id);
  if (!fresh) throw new UnauthenticatedError(INVALID_CREDENTIALS);

  return { user: await toAuthUser(fresh), tokens };
};

/* ------------------------------------------------------------------ */
/* Refresh                                                             */
/* ------------------------------------------------------------------ */

export const refresh = async (
  presentedToken: string,
  rememberMe = false,
): Promise<{ tokens: TokenPair; user: AuthUser }> => {
  const payload = verifyRefreshToken(presentedToken);
  const stored = await repository.findRefreshToken(hashToken(presentedToken));

  if (!stored) throw new UnauthenticatedError('Session not recognised, please sign in again');

  if (stored.revokedAt) {
    // Replay of a rotated token: assume compromise and kill the whole family.
    await repository.revokeTokenFamily(stored.familyId, 'REUSE_DETECTED');
    logger.warn(
      { userId: stored.userId, familyId: stored.familyId },
      'Refresh token reuse detected — family revoked',
    );
    throw new UnauthenticatedError('Session is no longer valid, please sign in again');
  }

  if (stored.expiresAt < new Date()) {
    throw new UnauthenticatedError('Session expired, please sign in again');
  }

  const user = await repository.findUserById(stored.userId);
  if (!user || !user.isActive || user.deletedAt || user.status === 'DISABLED' || user.status === 'SUSPENDED') {
    await repository.revokeTokenFamily(stored.familyId, 'ACCOUNT_INACTIVE');
    throw new UnauthenticatedError('This account can no longer sign in');
  }

  if (user.tokenVersion !== payload.tv) {
    await repository.revokeTokenFamily(stored.familyId, 'TOKEN_VERSION_BUMPED');
    throw new UnauthenticatedError('Session is no longer valid, please sign in again');
  }

  const tokens = await issueTokens(
    {
      id: user.id,
      email: user.email,
      tokenVersion: user.tokenVersion,
      isSuperAdmin: user.isSuperAdmin,
    },
    user.roles.map(({ role }) => role.slug),
    { rememberMe, familyId: stored.familyId },
  );

  await repository.revokeRefreshToken(stored.id, 'ROTATED');

  return { tokens, user: await toAuthUser(user) };
};

/* ------------------------------------------------------------------ */
/* Logout                                                              */
/* ------------------------------------------------------------------ */

export const logout = async (
  presentedToken: string | undefined,
  userId?: string,
): Promise<void> => {
  let resolvedUserId = userId;

  if (presentedToken) {
    const stored = await repository.findRefreshToken(hashToken(presentedToken));
    if (stored && !stored.revokedAt) {
      await repository.revokeTokenFamily(stored.familyId, 'LOGOUT');
      resolvedUserId ??= stored.userId;
    }
  }

  if (resolvedUserId) {
    // Logout tolerates an expired access token, so `req.auth` may be absent and
    // the context unattributed — resolve the account from the cookie instead.
    const account = await repository.findUserById(resolvedUserId);
    if (account) attributeTo(account);

    await recordAudit({ action: 'LOGOUT', entityType: 'User', entityId: resolvedUserId });
  }
};

/**
 * Sign out everywhere: revoke every live refresh token *and* bump `tokenVersion`,
 * in one transaction. The first kills the refresh tokens; the second kills every
 * already-issued access token without needing a blacklist.
 */
export const logoutAllSessions = async (userId: string): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    await repository.revokeAllUserTokens(userId, 'LOGOUT_ALL', tx);
    await tx.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
  });

  await recordAudit({ action: 'LOGOUT', entityType: 'User', entityId: userId });
};

/* ------------------------------------------------------------------ */
/* Profile & passwords                                                 */
/* ------------------------------------------------------------------ */

export const getCurrentUser = async (userId: string): Promise<AuthUser> => {
  const user = await repository.findUserById(userId);
  if (!user) throw new NotFoundError('User');
  return toAuthUser(user);
};

export const updateProfile = async (
  userId: string,
  input: { fullName: string; phone?: string | null; avatarUrl?: string | null },
): Promise<AuthUser> => {
  const before = await repository.findUserById(userId);
  if (!before) throw new NotFoundError('User');

  // `''` from a cleared form field means "remove it", not "set it to empty".
  const after = {
    fullName: input.fullName,
    mobile: input.phone ? input.phone : null,
    avatarUrl: input.avatarUrl ? input.avatarUrl : null,
  };

  await repository.updateProfile(userId, after);

  await recordUpdateAudit(
    'User',
    userId,
    before.email,
    { fullName: before.fullName, mobile: before.mobile, avatarUrl: before.avatarUrl },
    after,
  );

  return getCurrentUser(userId);
};

/**
 * Live sessions for the signed-in account. `currentTokenHash` comes from the
 * refresh cookie on the request, so the device being used is labelled rather than
 * left for the user to guess at from a user-agent string.
 */
export const listSessions = async (
  userId: string,
  currentTokenHash?: string,
): Promise<SessionDto[]> => {
  const sessions = await repository.findActiveSessions(userId);

  return sessions.map(({ tokenHash, ...session }) => ({
    id: session.id,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    userAgent: session.userAgent,
    ipAddress: session.ipAddress,
    isCurrent: Boolean(currentTokenHash) && tokenHash === currentTokenHash,
  }));
};

export const changePassword = async (
  userId: string,
  input: { currentPassword: string; newPassword: string },
): Promise<void> => {
  const user = await repository.findUserWithPassword(userId);
  if (!user) throw new NotFoundError('User');

  const matches = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!matches) throw new UnauthenticatedError('Your current password is incorrect');

  const passwordHash = await hashPassword(input.newPassword);

  await prisma.$transaction(async (tx) => {
    // Bumping tokenVersion signs out every other device, which is the expected
    // behaviour after a password change.
    await repository.updatePassword(userId, passwordHash, { bumpTokenVersion: true }, tx);
    await repository.revokeAllUserTokens(userId, 'PASSWORD_CHANGED', tx);
  });

  await recordAudit({
    action: 'PASSWORD_CHANGE',
    entityType: 'User',
    entityId: userId,
    entityLabel: user.email,
  });
};

/**
 * Always resolves, whether or not the email exists — the response must not tell a
 * caller which addresses are registered. The token is returned so the caller can
 * hand it to a mail transport; nothing else ever exposes it.
 */
export const requestPasswordReset = async (
  emailAddress: string,
): Promise<{ token: string; userId: string; fullName: string } | null> => {
  const user = await repository.findUserByEmail(emailAddress);
  if (!user || !user.isActive || user.deletedAt || user.status === 'DISABLED') return null;

  const token = generateToken(48);
  const context = getContext();

  await repository.invalidateUserResetTokens(user.id);
  await repository.createPasswordResetToken({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000),
    ipAddress: context?.ipAddress ?? null,
  });

  logger.info({ userId: user.id }, 'Password reset requested');

  return { token, userId: user.id, fullName: user.fullName };
};

export const resetPassword = async (token: string, newPassword: string): Promise<void> => {
  const stored = await repository.findPasswordResetToken(hashToken(token));

  if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
    throw new UnauthenticatedError('This reset link is invalid or has expired');
  }

  const passwordHash = await hashPassword(newPassword);

  // Unauthenticated route: attribute the entry so it reaches the tenant's log.
  const account = await repository.findUserById(stored.userId);
  if (account) attributeTo(account);

  await prisma.$transaction(async (tx) => {
    await repository.consumePasswordResetToken(stored.id, tx);
    await repository.updatePassword(stored.userId, passwordHash, { bumpTokenVersion: true }, tx);
    await repository.revokeAllUserTokens(stored.userId, 'PASSWORD_RESET', tx);
  });

  await recordAudit({ action: 'PASSWORD_RESET', entityType: 'User', entityId: stored.userId });
};
