import type { AuditFields, UUID } from '../common.js';

export interface SiteDto extends AuditFields {
  id: UUID;
  name: string;
  location: string | null;
  clientName: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface SiteRequest {
  name: string;
  location?: string | null;
  clientName?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

export interface ExpenseCategoryDto extends AuditFields {
  id: UUID;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ExpenseCategoryRequest {
  name: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

/** Picker entry for sites, categories and employees. */
export interface OptionDto {
  id: UUID;
  name: string;
  /** Secondary line — location, mobile, designation. */
  hint: string | null;
}
