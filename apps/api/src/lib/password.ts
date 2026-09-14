import bcrypt from 'bcryptjs';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { env } from '../config/env.js';

export const hashPassword = (plain: string): Promise<string> =>
  bcrypt.hash(plain, env.BCRYPT_ROUNDS);

export const verifyPassword = (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);

/** URL-safe opaque token — used for password reset links. */
export const generateToken = (bytes = 48): string => randomBytes(bytes).toString('base64url');

/**
 * Refresh and reset tokens are stored hashed, so a database leak cannot be
 * replayed. SHA-256 (not bcrypt) is right here: the token is already 48 bytes of
 * entropy, so slow hashing buys nothing and would cost a lookup per row.
 */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export const safeCompare = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
};

/** Temporary password for invited users, satisfying the strength policy. */
export const generateTemporaryPassword = (): string => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '@#$%&*';
  const all = upper + lower + digits + symbols;

  const pick = (charset: string) => charset[randomBytes(1)[0]! % charset.length]!;

  const required = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  const filler = Array.from({ length: 8 }, () => pick(all));

  return [...required, ...filler].sort(() => (randomBytes(1)[0]! > 127 ? 1 : -1)).join('');
};
