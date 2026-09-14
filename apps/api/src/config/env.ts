import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment is validated once, at boot. A missing or malformed variable is a
 * startup failure rather than a runtime surprise three hours later.
 */

const durationString = z.string().regex(/^\d+(ms|s|m|h|d)$/, 'expected a duration like "15m"');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // A TCP port locally; under IIS/iisnode it is a named pipe such as `\\.\pipe\<guid>`.
  PORT: z
    .string()
    .default('4100')
    .transform((value) => (/^\d+$/.test(value) ? Number(value) : value)),
  API_PREFIX: z.string().startsWith('/').default('/api/v1'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: durationString.default('15m'),
  JWT_REFRESH_TTL: durationString.default('7d'),
  JWT_REFRESH_TTL_LONG: durationString.default('30d'),
  JWT_ISSUER: z.string().default('liveconsole-ops'),

  WEB_ORIGIN: z.string().default('http://localhost:5273'),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  SEED_ORG_CODE: z.string().min(1).default('DEMO'),
  SEED_COMPANY_NAME: z.string().default('Demo Organization'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@example.com'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('ChangeMe@123'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  // Deliberately not the logger — the logger itself reads config.
  console.error(`\nInvalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/** Comma-separated origins are supported so staging can allow more than one. */
export const allowedOrigins = env.WEB_ORIGIN.split(',').map((origin) => origin.trim());
