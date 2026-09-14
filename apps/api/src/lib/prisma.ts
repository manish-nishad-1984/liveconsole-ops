import { Prisma, PrismaClient } from '@prisma/client';

import { isProduction } from '../config/env.js';
import { ConflictError, NotFoundError } from './errors.js';
import { logger } from './logger.js';

/**
 * One PrismaClient for the process. `globalThis` caching keeps `tsx watch` from
 * opening a new connection pool on every reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction
      ? [{ emit: 'event', level: 'error' }]
      : [
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' },
        ],
  });

prisma.$on('error' as never, (event: Prisma.LogEvent) => {
  logger.error({ target: event.target }, event.message);
});

if (!isProduction) {
  prisma.$on('warn' as never, (event: Prisma.LogEvent) => {
    logger.warn({ target: event.target }, event.message);
  });

  globalForPrisma.prisma = prisma;
}

/** Transaction-aware client type, so repositories accept either. */
export type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export type Db = PrismaClient | PrismaTransaction;

/**
 * Translate Prisma's error codes into our HTTP-facing errors. Called from the
 * global error handler so no repository has to know about `P2002`.
 */
export const mapPrismaError = (error: unknown): Error | null => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;

  switch (error.code) {
    case 'P2002': {
      const target = error.meta?.target;
      const fields = Array.isArray(target) ? target.join(', ') : String(target ?? 'value');
      return new ConflictError(`A record with this ${fields} already exists`);
    }
    case 'P2003':
      return new ConflictError('A related record is missing or invalid');
    case 'P2014':
    case 'P2025':
      return new NotFoundError('Record', 'The requested record no longer exists');
    default:
      return null;
  }
};

export const disconnectPrisma = async (): Promise<void> => {
  await prisma.$disconnect();
};
