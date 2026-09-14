import { prisma, type Db } from '../../lib/prisma.js';

/**
 * Data access for authentication. All Prisma calls for this module live here —
 * the service holds the policy, the repository holds the queries.
 */

/** Everything the token/permission pipeline needs about an account. */
export const userSelect = {
  id: true,
  organizationId: true,
  employeeCode: true,
  fullName: true,
  email: true,
  mobile: true,
  avatarUrl: true,
  designation: true,
  status: true,
  isActive: true,
  deletedAt: true,
  isSuperAdmin: true,
  mustChangePassword: true,
  tokenVersion: true,
  lastLoginAt: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  branchId: true,
  roles: {
    where: { role: { isActive: true } },
    select: {
      role: {
        select: {
          id: true,
          name: true,
          slug: true,
          isSystem: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
    },
  },
} as const;

export const findUserByEmail = (emailAddress: string) =>
  prisma.user.findUnique({
    where: { email: emailAddress },
    select: { ...userSelect, passwordHash: true },
  });

/**
 * Mobile numbers are not unique at the database level, so two rows are returned
 * rather than one and the caller decides what an ambiguous number means.
 * Soft-deleted accounts are excluded: a departed employee's number may be reissued.
 */
export const findUsersByMobile = (mobile: string) =>
  prisma.user.findMany({
    where: { mobile, deletedAt: null },
    select: { ...userSelect, passwordHash: true },
    take: 2,
  });

export const findUserById = (userId: string) =>
  prisma.user.findUnique({ where: { id: userId }, select: userSelect });

export const findUserWithPassword = (userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, passwordHash: true, tokenVersion: true },
  });

export type AuthUserRecord = NonNullable<Awaited<ReturnType<typeof findUserById>>>;

/**
 * The signed-in user's organisation, for the `/auth/me` payload. Scoped by the
 * user's own `organizationId` rather than "the first row", so it stays correct
 * once more than one tenant exists.
 */
export const findOrganizationById = (organizationId: string) =>
  prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      legalName: true,
      logoUrl: true,
      currency: true,
      timezone: true,
      fiscalYearStartMonth: true,
    },
  });

/* ------------------------------------------------------------------ */
/* Login attempt bookkeeping                                           */
/* ------------------------------------------------------------------ */

export const registerFailedLogin = (userId: string, lockedUntil: Date | null) =>
  prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: { increment: 1 },
      ...(lockedUntil ? { lockedUntil } : {}),
    },
    select: { failedLoginAttempts: true },
  });

/** `activate` flips an INVITED account to ACTIVE on its first successful sign-in. */
export const registerSuccessfulLogin = (
  userId: string,
  ipAddress: string | null,
  activate = false,
) =>
  prisma.user.update({
    where: { id: userId },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress,
      failedLoginAttempts: 0,
      lockedUntil: null,
      ...(activate ? { status: 'ACTIVE' as const } : {}),
    },
    select: { id: true },
  });

/* ------------------------------------------------------------------ */
/* Refresh tokens                                                      */
/* ------------------------------------------------------------------ */

export const createRefreshToken = (
  data: {
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
    userAgent: string | null;
    ipAddress: string | null;
  },
  db: Db = prisma,
) => db.refreshToken.create({ data, select: { id: true, familyId: true } });

export const findRefreshToken = (tokenHash: string) =>
  prisma.refreshToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, familyId: true, expiresAt: true, revokedAt: true },
  });

export const revokeRefreshToken = (
  id: string,
  reason: string,
  replacedByTokenId?: string,
  db: Db = prisma,
) =>
  db.refreshToken.update({
    where: { id },
    data: { revokedAt: new Date(), revokedReason: reason, replacedByTokenId },
    select: { id: true },
  });

/**
 * Revoke every live token in a rotation family. Called when an already-used token
 * is presented again, which means the token was replayed — most likely stolen.
 */
export const revokeTokenFamily = (familyId: string, reason: string, db: Db = prisma) =>
  db.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });

export const revokeAllUserTokens = (userId: string, reason: string, db: Db = prisma) =>
  db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });

export const deleteExpiredRefreshTokens = () =>
  prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });

/** Live sessions for the account, newest first — what the profile screen lists. */
export const findActiveSessions = (userId: string) =>
  prisma.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
      userAgent: true,
      ipAddress: true,
      tokenHash: true,
    },
    take: 20,
  });

/* ------------------------------------------------------------------ */
/* Password management                                                 */
/* ------------------------------------------------------------------ */

export const updatePassword = (
  userId: string,
  passwordHash: string,
  options: { bumpTokenVersion?: boolean } = {},
  db: Db = prisma,
) =>
  db.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      mustChangePassword: false,
      ...(options.bumpTokenVersion ? { tokenVersion: { increment: 1 } } : {}),
    },
    select: { id: true, email: true, fullName: true },
  });

/** Self-service profile edit — the whitelist of columns a user may change. */
export const updateProfile = (
  userId: string,
  data: { fullName: string; mobile: string | null; avatarUrl: string | null },
) => prisma.user.update({ where: { id: userId }, data, select: { id: true } });

export const createPasswordResetToken = (data: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress: string | null;
}) => prisma.passwordResetToken.create({ data, select: { id: true } });

export const findPasswordResetToken = (tokenHash: string) =>
  prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

export const consumePasswordResetToken = (id: string, db: Db = prisma) =>
  db.passwordResetToken.update({
    where: { id },
    data: { usedAt: new Date() },
    select: { id: true },
  });

export const invalidateUserResetTokens = (userId: string, db: Db = prisma) =>
  db.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });
