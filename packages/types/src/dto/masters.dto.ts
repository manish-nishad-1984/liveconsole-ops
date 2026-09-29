import type { AuditFields, UUID } from '../common.js';

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

/** Picker entry for categories and employees. */
export interface OptionDto {
  id: UUID;
  name: string;
  /** Secondary line — location, mobile, designation. */
  hint: string | null;
}

/**
 * Tenant settings an administrator may change without a release.
 * `expenseBackdateDays` counts today as 0: 2 means today, yesterday and the day
 * before are open to an ordinary employee.
 */
export interface OrgSettingsDto {
  expenseBackdateDays: number;
  /** Upper bound the API will accept, so the form can say so before submitting. */
  maxExpenseBackdateDays: number;
}

export interface OrgSettingsRequest {
  expenseBackdateDays?: number;
}
