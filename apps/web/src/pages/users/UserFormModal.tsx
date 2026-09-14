import { zodResolver } from '@hookform/resolvers/zod';
import { meetsPasswordPolicy } from '@liveconsole-ops/shared';
import type { RoleDto, UserDto } from '@liveconsole-ops/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { FormAlert } from '@/components/common/FormAlert';
import { FormField } from '@/components/common/FormField';
import { FormGrid, FormModal, FormSection } from '@/components/common/FormModal';
import { PasswordInput } from '@/components/common/PasswordInput';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { queryKeys } from '@/lib/query-client';
import { rolesService } from '@/services/roles.service';
import { usersService } from '@/services/users.service';
import { applyFieldErrors } from '@/utils/errors';

/**
 * Create / edit a user.
 *
 * Roles are a checkbox list rather than a multi-select: the list is short, and
 * seeing every role at once with the granted ones ticked is what makes "who can do
 * what" legible. At least one is required — an account with no role can sign in
 * and then do nothing, which reads as a broken login.
 *
 * On create, leaving the password blank invites the user instead: the server
 * generates a temporary password, returns it exactly once, and forces a change on
 * first sign-in.
 */

const NO_BRANCH = '__none__';

const schema = z.object({
  fullName: z.string().trim().min(1, 'Enter a name').max(120),
  email: z.string().trim().min(1, 'Enter an email address').email('Enter a valid email address'),
  phone: z.string().trim().max(20),
  employeeCode: z.string().trim().max(30),
  designation: z.string().trim().max(80),
  branchId: z.string(),
  roleIds: z.array(z.string()).min(1, 'Assign at least one role'),
  // Blank means "invite them"; anything else must clear the same policy the API
  // enforces, so the form cannot offer a password the server will reject.
  password: z
    .string()
    .refine(
      (value) => value === '' || meetsPasswordPolicy(value),
      'Password does not meet the requirements',
    ),
});

type UserForm = z.infer<typeof schema>;

export interface UserFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null for a create. */
  user: UserDto | null;
  /** Surfaces the generated temporary password to the caller, shown once. */
  onCreatedWithTemporaryPassword?: (email: string, password: string) => void;
}

export const UserFormModal = ({
  open,
  onOpenChange,
  user,
  onCreatedWithTemporaryPassword,
}: UserFormModalProps) => {
  const queryClient = useQueryClient();
  const isEdit = Boolean(user);
  const [formError, setFormError] = useState<string | null>(null);

  const roles = useQuery({
    queryKey: queryKeys.roles.list({ pageSize: 100 }),
    queryFn: () => rolesService.list({ pageSize: 100 }),
    enabled: open,
  });

  const branches = useQuery({
    queryKey: queryKeys.users.branches,
    queryFn: () => usersService.branches(),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    setError,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UserForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      employeeCode: '',
      designation: '',
      branchId: NO_BRANCH,
      roleIds: [],
      password: '',
    },
  });

  // Reset when the target record changes — otherwise the previous user's values
  // stay in the form the next time the modal opens.
  useEffect(() => {
    if (!open) return;
    reset({
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      employeeCode: user?.employeeCode ?? '',
      designation: user?.designation ?? '',
      branchId: user?.branchId ?? NO_BRANCH,
      roleIds: user?.roles.map((role) => role.id) ?? [],
      password: '',
    });
    setFormError(null);
  }, [open, user, reset]);

  const mutation = useMutation({
    mutationFn: async (values: UserForm) => {
      const payload = {
        fullName: values.fullName,
        email: values.email,
        phone: values.phone || null,
        employeeCode: values.employeeCode || null,
        designation: values.designation || null,
        branchId: values.branchId === NO_BRANCH ? null : values.branchId,
        roleIds: values.roleIds,
      };

      if (user) return usersService.update(user.id, payload);

      return usersService.create({
        ...payload,
        ...(values.password ? { password: values.password } : {}),
      });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles.all });

      const temporaryPassword =
        'temporaryPassword' in result ? (result.temporaryPassword as string | null) : null;

      if (!isEdit && temporaryPassword) {
        onCreatedWithTemporaryPassword?.(result.email, temporaryPassword);
      } else {
        toast.success(isEdit ? 'User updated' : 'User created');
      }

      onOpenChange(false);
    },
    onError: (error) => {
      setFormError(
        applyFieldErrors(error, setError, {
          knownFields: ['fullName', 'email', 'phone', 'employeeCode', 'designation', 'password'],
          fallback: 'Could not save this user.',
        }),
      );
    },
  });

  const selectedRoleIds = watch('roleIds');
  const password = watch('password');

  const toggleRole = (roleId: string, checked: boolean) => {
    setValue(
      'roleIds',
      checked
        ? [...selectedRoleIds, roleId]
        : selectedRoleIds.filter((id) => id !== roleId),
      { shouldValidate: true },
    );
  };

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `Edit ${user?.fullName}` : 'Add a user'}
      description={
        isEdit
          ? 'Profile details and role assignment.'
          : 'Leave the password blank to invite the user with a generated temporary one.'
      }
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      submitLabel={isEdit ? 'Save changes' : 'Create user'}
      isSubmitting={isSubmitting || mutation.isPending}
    >
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

      <FormGrid>
        <FormField label="Full name" error={errors.fullName?.message} required>
          {(props) => <Input {...props} {...register('fullName')} autoComplete="off" />}
        </FormField>

        <FormField label="Email" error={errors.email?.message} required>
          {(props) => (
            <Input {...props} {...register('email')} type="email" autoComplete="off" />
          )}
        </FormField>

        <FormField
          label="Mobile"
          error={errors.phone?.message}
          hint="Doubles as a sign-in identifier."
        >
          {(props) => <Input {...props} {...register('phone')} inputMode="tel" />}
        </FormField>

        <FormField label="Employee code" error={errors.employeeCode?.message}>
          {(props) => <Input {...props} {...register('employeeCode')} />}
        </FormField>

        <FormField label="Designation" error={errors.designation?.message}>
          {(props) => <Input {...props} {...register('designation')} />}
        </FormField>

        <FormField label="Branch">
          {(props) => (
            <Select
              value={watch('branchId')}
              onValueChange={(value) => setValue('branchId', value, { shouldDirty: true })}
            >
              <SelectTrigger id={props.id}>
                <SelectValue placeholder="No branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_BRANCH}>No branch</SelectItem>
                {(branches.data ?? []).map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
      </FormGrid>

      <FormSection title="Roles" description="Permissions come from the roles assigned here.">
        {errors.roleIds ? (
          <p role="alert" className="text-2xs font-medium text-destructive">
            {errors.roleIds.message}
          </p>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          {(roles.data?.items ?? []).map((role: RoleDto) => (
            <label
              key={role.id}
              className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border px-3 py-2 transition-colors hover:bg-accent/50"
            >
              <Checkbox
                className="mt-0.5"
                checked={selectedRoleIds.includes(role.id)}
                onCheckedChange={(checked) => toggleRole(role.id, checked === true)}
              />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium">{role.name}</span>
                <span className="block truncate text-2xs text-muted-foreground">
                  {role.description ?? `${role.permissionCount} permissions`}
                </span>
              </span>
            </label>
          ))}
        </div>
      </FormSection>

      {isEdit ? null : (
        <FormSection
          title="Initial password"
          description="Leave blank to generate a temporary one and force a change on first sign-in."
        >
          <FormField label="Password" error={errors.password?.message}>
            {(props) => (
              <PasswordInput
                {...props}
                {...register('password')}
                autoComplete="new-password"
                showStrength={Boolean(password)}
                value={password}
              />
            )}
          </FormField>
        </FormSection>
      )}
    </FormModal>
  );
};
