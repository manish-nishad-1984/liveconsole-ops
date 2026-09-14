import { REGEX } from '../constants.js';

/**
 * Sign-in identity.
 *
 * A user signs in with either their email address or their mobile number, so the
 * API and the login form both need the same rule for telling the two apart and
 * for normalising what was typed. Two copies of this would eventually disagree
 * about whether `+91 98250 00001` is a mobile number, and the disagreement would
 * show up as "wrong password" on an account whose password is perfectly correct.
 */

export type LoginIdentifierKind = 'email' | 'mobile' | 'unknown';

/**
 * Reduces anything a person might type to the bare digits stored on the account:
 * `+91 98250-00001`, `09825000001` and `9825000001` are one number. Returns null
 * when the result is not a valid mobile number.
 */
export const normaliseMobile = (value: string): string | null => {
  const digits = value.replace(/\D/g, '');

  const local =
    digits.length === 12 && digits.startsWith('91')
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith('0')
        ? digits.slice(1)
        : digits;

  return REGEX.PHONE.test(local) ? local : null;
};

export interface ParsedLoginIdentifier {
  kind: LoginIdentifierKind;
  /** Lower-cased email address, or the bare mobile number. */
  value: string;
}

/**
 * An `@` decides it: anything containing one is being offered as an email and is
 * judged as an email, rather than silently falling through to a mobile lookup
 * that could never match. That keeps the error message truthful.
 */
export const parseLoginIdentifier = (raw: string): ParsedLoginIdentifier => {
  const trimmed = raw.trim();

  if (trimmed.includes('@')) {
    return {
      kind: REGEX.EMAIL.test(trimmed) ? 'email' : 'unknown',
      value: trimmed.toLowerCase(),
    };
  }

  const mobile = normaliseMobile(trimmed);
  return mobile ? { kind: 'mobile', value: mobile } : { kind: 'unknown', value: trimmed };
};
