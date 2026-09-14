import type { ISODateString, UUID } from './common.js';
import type { UserStatus } from './enums.js';
import type { PermissionKey } from './rbac.js';

/* ------------------------------------------------------------------ */
/* Requests                                                            */
/* ------------------------------------------------------------------ */

export interface LoginRequest {
  /** Email address or mobile number — the API decides which it is. */
  identifier: string;
  password: string;
  /** Extends refresh-token lifetime from session length to the long TTL. */
  rememberMe?: boolean;
}

export interface RefreshRequest {
  /** Optional: omitted when the refresh token travels in the httpOnly cookie. */
  refreshToken?: string;
  rememberMe?: boolean;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * What a user may change about their own account. Everything else — employee
 * code, designation, branch, roles, status — is administered through the Users
 * module, so nobody can promote themselves by editing their profile.
 */
export interface UpdateProfileRequest {
  fullName: string;
  phone?: string | null;
  avatarUrl?: string | null;
}

/* ------------------------------------------------------------------ */
/* Responses                                                           */
/* ------------------------------------------------------------------ */

/** The `/auth/me` payload — everything the shell needs to render itself. */
export interface AuthUser {
  id: UUID;
  employeeCode: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  designation: string | null;
  status: UserStatus;
  isSuperAdmin: boolean;
  mustChangePassword: boolean;
  lastLoginAt: ISODateString | null;
  roles: AuthRole[];
  /** Flattened union of every permission granted by the user's roles. */
  permissions: PermissionKey[];
  organization: AuthOrganization | null;
  branchId: UUID | null;
}

export interface AuthRole {
  id: UUID;
  name: string;
  slug: string;
  isSystem: boolean;
}

export interface AuthOrganization {
  id: UUID;
  code: string;
  name: string;
  legalName: string | null;
  logoUrl: string | null;
  currency: string;
  timezone: string;
  fiscalYearStartMonth: number;
}

export interface TokenPair {
  accessToken: string;
  /** Absent on the wire — the refresh token is delivered as an httpOnly cookie. */
  refreshToken?: string;
  /** Access-token lifetime in seconds. */
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface LoginResponse {
  user: AuthUser;
  tokens: TokenPair;
}

/**
 * One live sign-in, as shown on the profile screen. The refresh token itself is
 * never part of this — only enough to recognise a device you do not remember.
 */
export interface SessionDto {
  id: UUID;
  createdAt: ISODateString;
  expiresAt: ISODateString;
  userAgent: string | null;
  ipAddress: string | null;
  /** The session making the request, which cannot be mistaken for another device. */
  isCurrent: boolean;
}

/* ------------------------------------------------------------------ */
/* Token payloads (API-internal, typed here so both sides agree)       */
/* ------------------------------------------------------------------ */

export interface AccessTokenPayload {
  sub: UUID;
  email: string;
  roles: string[];
  isSuperAdmin: boolean;
  /** Token version — bumped to invalidate every outstanding token for a user. */
  tv: number;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: UUID;
  /**
   * This token's own id. Unique per issuance — without it two tokens minted in
   * the same second for the same family are byte-identical, and rotation fails
   * on the stored hash's unique constraint instead of rotating.
   */
  jti: UUID;
  /** Refresh-token family, used to detect and revoke reuse. */
  fam: UUID;
  tv: number;
  iat?: number;
  exp?: number;
}
