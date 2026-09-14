import type { PermissionKey } from '@liveconsole-ops/types';

/**
 * Request augmentation. `req.auth` is populated by the `authenticate` middleware
 * and is the only sanctioned source of identity inside controllers — never read a
 * user id or an organisation id out of the body or query string.
 */
declare global {
  namespace Express {
    interface AuthenticatedActor {
      userId: string;
      /** Tenant the actor belongs to. Every tenant query must be scoped by it. */
      organizationId: string;
      email: string | null;
      isSuperAdmin: boolean;
      roles: string[];
      permissions: Set<PermissionKey>;
      tokenVersion: number;
    }

    interface Request {
      auth?: AuthenticatedActor;
      requestId: string;
    }
  }
}

export {};
