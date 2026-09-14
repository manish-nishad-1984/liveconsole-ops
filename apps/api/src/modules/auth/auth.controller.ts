import type { Request, Response } from 'express';

import { env } from '../../config/env.js';
import { UnauthenticatedError } from '../../lib/errors.js';
import { noContent, ok } from '../../lib/http.js';
import { refreshTokenTtlSeconds } from '../../lib/jwt.js';
import { hashToken } from '../../lib/password.js';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from './auth.schema.js';
import * as authService from './auth.service.js';

/**
 * The refresh token lives in an httpOnly cookie, so XSS on the SPA cannot read it.
 * The short-lived access token is returned in the body and held in memory by the
 * web app — never in localStorage.
 */
export const REFRESH_COOKIE = 'lcops_refresh_token';

const cookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax' as const,
  domain: env.COOKIE_DOMAIN,
  // Scoped to the auth routes: no other endpoint has any use for it.
  path: `${env.API_PREFIX}/auth`,
  maxAge: maxAgeSeconds * 1000,
});

const setRefreshCookie = (res: Response, token: string, rememberMe: boolean): void => {
  res.cookie(REFRESH_COOKIE, token, cookieOptions(refreshTokenTtlSeconds(rememberMe)));
};

const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(0), maxAge: undefined });
};

const readRefreshToken = (req: Request): string | undefined =>
  (req.cookies?.[REFRESH_COOKIE] as string | undefined) ??
  (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined);

/* ------------------------------------------------------------------ */

export const login = async (req: Request, res: Response): Promise<Response> => {
  const input = req.body as LoginInput;
  const { user, tokens } = await authService.login(input);

  setRefreshCookie(res, tokens.refreshToken!, input.rememberMe);

  // The refresh token is stripped from the body: it already travels as a cookie,
  // and returning it twice invites the client to store it somewhere less safe.
  const { refreshToken: _omitted, ...safeTokens } = tokens;
  return ok(res, { user, tokens: safeTokens });
};

export const refresh = async (req: Request, res: Response): Promise<Response> => {
  const presented = readRefreshToken(req);
  if (!presented) throw new UnauthenticatedError('No session to refresh');

  const rememberMe = Boolean(req.body?.rememberMe);
  const { tokens, user } = await authService.refresh(presented, rememberMe);

  setRefreshCookie(res, tokens.refreshToken!, rememberMe);

  const { refreshToken: _omitted, ...safeTokens } = tokens;
  return ok(res, { user, tokens: safeTokens });
};

export const logout = async (req: Request, res: Response): Promise<Response> => {
  await authService.logout(readRefreshToken(req), req.auth?.userId);
  clearRefreshCookie(res);
  return noContent(res);
};

export const logoutAll = async (req: Request, res: Response): Promise<Response> => {
  await authService.logoutAllSessions(req.auth!.userId);
  clearRefreshCookie(res);
  return noContent(res);
};

export const me = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await authService.getCurrentUser(req.auth!.userId));

export const updateProfile = async (req: Request, res: Response): Promise<Response> =>
  ok(res, await authService.updateProfile(req.auth!.userId, req.body as UpdateProfileInput));

export const sessions = async (req: Request, res: Response): Promise<Response> => {
  const presented = readRefreshToken(req);
  return ok(
    res,
    await authService.listSessions(req.auth!.userId, presented ? hashToken(presented) : undefined),
  );
};

export const changePassword = async (req: Request, res: Response): Promise<Response> => {
  await authService.changePassword(req.auth!.userId, req.body as ChangePasswordInput);
  clearRefreshCookie(res);
  return ok(res, { message: 'Password updated. Please sign in again.' });
};

export const forgotPassword = async (req: Request, res: Response): Promise<Response> => {
  const { email } = req.body as ForgotPasswordInput;
  const result = await authService.requestPasswordReset(email);

  // Same response either way, so the endpoint cannot be used to enumerate accounts.
  return ok(res, {
    message: 'If that email is registered, a password reset link has been sent.',
    // Surfacing the token in development removes the need for a mail server locally.
    ...(env.NODE_ENV === 'development' && result ? { devToken: result.token } : {}),
  });
};

export const resetPassword = async (req: Request, res: Response): Promise<Response> => {
  const { token, password } = req.body as ResetPasswordInput;
  await authService.resetPassword(token, password);
  return ok(res, { message: 'Password reset. You can now sign in.' });
};
