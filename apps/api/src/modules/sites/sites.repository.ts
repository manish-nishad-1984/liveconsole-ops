import type { Prisma } from '@prisma/client';

import { resolveOrderBy, resolvePagination } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import { and, equals, searchAcross } from '../../lib/query.js';
import { SITE_SORT_FIELDS, type SiteListQueryInput } from './sites.schema.js';

export const siteSelect = {
  id: true,
  name: true,
  location: true,
  clientName: true,
  notes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
  updatedById: true,
} satisfies Prisma.SiteSelect;

export type SiteRecord = Prisma.SiteGetPayload<{ select: typeof siteSelect }>;

export const listSites = async (organizationId: string, query: SiteListQueryInput) => {
  const where = and(
    { organizationId, deletedAt: null },
    searchAcross(query.search, ['name', 'location', 'clientName']),
    equals('isActive', query.isActive),
  ) as Prisma.SiteWhereInput;

  const { skip, take, page, pageSize } = resolvePagination(query);
  const orderBy = resolveOrderBy(query.sortBy, query.sortDir, SITE_SORT_FIELDS, {
    field: 'name',
    dir: 'asc',
  }) as Prisma.SiteOrderByWithRelationInput;

  const [items, total] = await Promise.all([
    prisma.site.findMany({ where, select: siteSelect, orderBy, skip, take }),
    prisma.site.count({ where }),
  ]);

  return { items, total, page, pageSize };
};

export const findSiteById = (organizationId: string, id: string) =>
  prisma.site.findFirst({
    where: { id, organizationId, deletedAt: null },
    select: siteSelect,
  });

/** Names are unique among live sites, ignoring case. */
export const findSiteByName = (organizationId: string, name: string) =>
  prisma.site.findFirst({
    where: {
      organizationId,
      deletedAt: null,
      name: { equals: name, mode: 'insensitive' },
    },
    select: { id: true },
  });

export const createSite = (data: Prisma.SiteUncheckedCreateInput) =>
  prisma.site.create({ data, select: siteSelect });

export const updateSite = (id: string, data: Prisma.SiteUncheckedUpdateInput) =>
  prisma.site.update({ where: { id }, data, select: siteSelect });

export const listSiteOptions = (organizationId: string) =>
  prisma.site.findMany({
    where: { organizationId, deletedAt: null, isActive: true },
    select: { id: true, name: true, location: true },
    orderBy: { name: 'asc' },
  });
