import type { AccessTokenPayload, RefreshTokenPayload } from '@liveconsole-ops/types';
import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from '../config/env.js';
import { TokenExpiredError, UnauthenticatedError } from './errors.js';

/**
 * Access and refresh tokens are signed with *different* secrets, so a leaked
 * access secret cannot be used to mint refresh tokens (and vice versa).
 */

const AUDIENCE = 'liveconsole-ops-web';

const baseOptions: SignOptions = {
  issuer: env.JWT_ISSUER,
  audience: AUDIENCE,
};

export const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    ...baseOptions,
    expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'],
  });

/**
 * `rememberMe` is the *entire* effect of the checkbox on the login form: a longer
 * refresh TTL. Nothing else about the session changes.
 */
export const signRefreshToken = (payload: RefreshTokenPayload, rememberMe = false): string =>
  jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    ...baseOptions,
    expiresIn: (rememberMe
      ? env.JWT_REFRESH_TTL_LONG
      : env.JWT_REFRESH_TTL) as SignOptions['expiresIn'],
  });

const verify = <T>(token: string, secret: string): T => {
  try {
    return jwt.verify(token, secret, {
      issuer: env.JWT_ISSUER,
      audience: AUDIENCE,
    }) as T;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenExpiredError();
    }
    throw new UnauthenticatedError('Invalid authentication token');
  }
};

export const verifyAccessToken = (token: string): AccessTokenPayload =>
  verify<AccessTokenPayload>(token, env.JWT_ACCESS_SECRET);

export const verifyRefreshToken = (token: string): RefreshTokenPayload =>
  verify<RefreshTokenPayload>(token, env.JWT_REFRESH_SECRET);

/** Convert `"15m"` to seconds, for the `expiresIn` field on the token response. */
export const durationToSeconds = (duration: string): number => {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(duration);
  if (!match) return 0;

  const value = Number(match[1]);
  const unitSeconds: Record<string, number> = { ms: 0.001, s: 1, m: 60, h: 3600, d: 86_400 };
  return Math.round(value * (unitSeconds[match[2] ?? 's'] ?? 0));
};

export const accessTokenTtlSeconds = (): number => durationToSeconds(env.JWT_ACCESS_TTL);

export const refreshTokenTtlSeconds = (rememberMe = false): number =>
  durationToSeconds(rememberMe ? env.JWT_REFRESH_TTL_LONG : env.JWT_REFRESH_TTL);
