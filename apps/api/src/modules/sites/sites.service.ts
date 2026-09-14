import type { OptionDto, Paginated, SiteDto } from '@liveconsole-ops/types';

import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { buildPaginationMeta } from '../../lib/pagination.js';
import { auditCreate, auditUpdate, requireOrg } from '../../lib/requestContext.js';
import { diffRecords, recordAudit } from '../../services/audit.service.js';
import * as repository from './sites.repository.js';
import type { SiteRecord } from './sites.repository.js';
import type { SiteInput, SiteListQueryInput, UpdateSiteInput } from './sites.schema.js';

const toDto = (site: SiteRecord): SiteDto => ({
  ...site,
  createdAt: site.createdAt.toISOString(),
  updatedAt: site.updatedAt.toISOString(),
});

export const list = async (query: SiteListQueryInput): Promise<Paginated<SiteDto>> => {
  const { items, total, page, pageSize } = await repository.listSites(requireOrg(), query);
  return {
    items: items.map(toDto),
    pagination: buildPaginationMeta(total, { page, pageSize }),
  };
};

const assertNameFree = async (organizationId: string, name: string, exceptId?: string) => {
  const clash = await repository.findSiteByName(organizationId, name);
  if (clash && clash.id !== exceptId) {
    throw new ConflictError('A site with this name already exists');
  }
};

export const create = async (input: SiteInput): Promise<SiteDto> => {
  const organizationId = requireOrg();
  await assertNameFree(organizationId, input.name);

  const site = await repository.createSite({
    organizationId,
    name: input.name,
    location: input.location ?? null,
    clientName: input.clientName ?? null,
    notes: input.notes ?? null,
    isActive: input.isActive ?? true,
    ...auditCreate(),
  });

  await recordAudit({
    action: 'CREATE',
    entityType: 'Site',
    entityId: site.id,
    entityLabel: site.name,
    changes: diffRecords(null, { name: site.name, location: site.location }),
  });

  return toDto(site);
};

export const update = async (id: string, input: UpdateSiteInput): Promise<SiteDto> => {
  const organizationId = requireOrg();
  const existing = await repository.findSiteById(organizationId, id);
  if (!existing) throw new NotFoundError('Site');

  if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
    await assertNameFree(organizationId, input.name, id);
  }

  const site = await repository.updateSite(id, { ...input, ...auditUpdate() });

  await recordAudit({
    action: 'UPDATE',
    entityType: 'Site',
    entityId: id,
    entityLabel: site.name,
    changes: diffRecords(existing, site),
  });

  return toDto(site);
};

/**
 * Soft delete. Expenses and cash entries keep pointing at the site, so their
 * history still reads correctly; the site just stops appearing in pickers.
 */
export const remove = async (id: string): Promise<SiteDto> => {
  const organizationId = requireOrg();
  const existing = await repository.findSiteById(organizationId, id);
  if (!existing) throw new NotFoundError('Site');

  const site = await repository.updateSite(id, {
    isActive: false,
    deletedAt: new Date(),
    ...auditUpdate(),
  });

  await recordAudit({
    action: 'DELETE',
    entityType: 'Site',
    entityId: id,
    entityLabel: site.name,
  });

  return toDto(site);
};

export const options = async (): Promise<OptionDto[]> => {
  const sites = await repository.listSiteOptions(requireOrg());
  return sites.map((site) => ({
    id: site.id,
    name: site.name,
    hint: site.location,
  }));
};
