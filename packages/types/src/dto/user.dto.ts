import type { AuditFields, ISODateString, UUID, UserRef } from '../common.js';
import type { UserStatus } from '../enums.js';

export interface UserRoleRef {
  id: UUID;
  name: string;
  slug: string;
}

export interface UserDto extends AuditFields {
  id: UUID;
  employeeCode: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  designation: string | null;
  status: UserStatus;
  isSuperAdmin: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: ISODateString | null;
  branchId: UUID | null;
  branchName: string | null;
  reportsToId: UUID | null;
  reportsTo: UserRef | null;
  roles: UserRoleRef[];
}

/** Email or mobile is required — one of them is what the person signs in with. */
export interface CreateUserRequest {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  employeeCode?: string | null;
  designation?: string | null;
  branchId?: UUID | null;
  reportsToId?: UUID | null;
  roleIds: UUID[];
  /** Omit to create an INVITED account with a generated temporary password. */
  password?: string;
}

export type UpdateUserRequest = Partial<Omit<CreateUserRequest, 'password'>> & {
  status?: UserStatus;
  isActive?: boolean;
};

export interface SetUserPasswordRequest {
  /** Omit to have the server generate one and return it once. */
  password?: string;
  mustChangePassword?: boolean;
}

/**
 * The one and only time a password is ever returned by the API: an administrator
 * has just set a temporary one and has to be able to read it out to the person.
 */
export interface SetUserPasswordResponse {
  temporaryPassword: string | null;
}

export interface BranchRef {
  id: UUID;
  code: string;
  name: string;
  isHeadOffice: boolean;
}
