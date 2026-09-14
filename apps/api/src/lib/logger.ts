import pino from 'pino';

import { env, isProduction } from '../config/env.js';

/**
 * Structured logs in production, human-readable in development. `redact` keeps
 * credentials and tokens out of the log stream permanently.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.currentPassword',
      '*.newPassword',
      '*.passwordHash',
      '*.accessToken',
      '*.refreshToken',
      '*.tokenHash',
    ],
    censor: '[redacted]',
  },
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
});

export type Logger = typeof logger;
