import type { ISODateString } from '../common.js';

/**
 * The starter dashboard reports on the only thing a boilerplate actually knows
 * about: who has access. Replace this DTO with your domain's own summary the
 * moment there is one.
 */
export interface DashboardSummaryDto {
  users: {
    total: number;
    active: number;
    invited: number;
    suspended: number;
  };
  roles: {
    total: number;
    system: number;
    custom: number;
  };
  activity: {
    /** Audit entries written in the last 24 hours. */
    last24h: number;
    lastSignInAt: ISODateString | null;
  };
  organization: {
    name: string;
    code: string;
    createdAt: ISODateString;
  } | null;
}
