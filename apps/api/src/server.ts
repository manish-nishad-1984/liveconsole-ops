import type { Server } from 'node:http';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { disconnectPrisma, prisma } from './lib/prisma.js';

/**
 * Process entry point: verify the database is reachable, start listening, and shut
 * down cleanly so in-flight requests finish and the connection pool is released.
 */

const start = async (): Promise<Server> => {
  await prisma.$queryRaw`SELECT 1`;
  logger.info('Database connection established');

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    const address = typeof env.PORT === 'number' ? `http://localhost:${env.PORT}` : env.PORT;
    logger.info(`API listening on ${address}${env.API_PREFIX} [${env.NODE_ENV}]`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received — shutting down`);

    server.close(async (error) => {
      if (error) logger.error({ err: error }, 'Error while closing the HTTP server');
      await disconnectPrisma();
      process.exit(error ? 1 : 0);
    });

    // Do not let a stuck connection hold the process open indefinitely.
    setTimeout(() => {
      logger.error('Forced shutdown after 10s grace period');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection');
  });

  process.on('uncaughtException', (error) => {
    // An uncaught exception leaves the process in an unknown state; exit and let
    // the supervisor restart it rather than continuing to serve traffic.
    logger.fatal({ err: error }, 'Uncaught exception — exiting');
    process.exit(1);
  });

  return server;
};

start().catch(async (error) => {
  logger.fatal({ err: error }, 'Failed to start the API');
  await disconnectPrisma();
  process.exit(1);
});
