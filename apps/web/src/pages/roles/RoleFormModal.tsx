import { zodResolver } from '@hookform/resolvers/zod';
import type { PermissionKey, RoleDto } from '@liveconsole-ops/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { FormAlert } from '@/components/common/FormAlert';
import { FormField } from '@/components/common/FormField';
import { FormGrid, FormModal, FormSection } from '@/components/common/FormModal';
import { LoadingState } from '@/components/common/LoadingState';
import { Input } from '@/components/ui/input';
import { queryKeys } from '@/lib/query-client';
import { PermissionMatrix } from '@/pages/roles/PermissionMatrix';
import { rolesService } from '@/services/roles.service';
import { applyFieldErrors } from '@/utils/errors';

/**
 * Create / edit a role.
 *
 * The whole point of the screen is the matrix below the two text fields: without
 * it, granting access means editing `role_permissions` rows by hand.
 *
 * Save submits the full checked set — the API diffs it against what the role holds
 * and writes only the difference, the same way the seeder does.
 */

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(60),
  description: z.string().trim().max(240),
});

type RoleForm = z.infer<typeof schema>;

export interface RoleFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null for a create. */
  role: RoleDto | null;
}

export const RoleFormModal = ({ open, onOpenChange, role }: RoleFormModalProps) => {
  const queryClient = useQueryClient();
  const isEdit = Boolean(role);
  const [formError, setFormError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const catalog = useQuery({
    queryKey: queryKeys.roles.permissionCatalog,
    queryFn: () => rolesService.permissionCatalog(),
    enabled: open,
    // The catalog is compiled into the API build; it cannot change under us.
    staleTime: Infinity,
  });

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RoleForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  });

  useEffect(() => {
    if (!open) return;
    reset({ name: role?.name ?? '', description: role?.description ?? '' });
    setSelected(new Set(role?.permissions ?? []));
    setFormError(null);
  }, [open, role, reset]);

  const mutation = useMutation({
    mutationFn: (values: RoleForm) => {
      const permissions = [...selected] as PermissionKey[];

      if (role) {
        return rolesService.update(role.id, {
          name: values.name,
          description: values.description || null,
          permissions,
        });
      }

      return rolesService.create({
        name: values.name,
        description: values.description || null,
        permissions,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles.all });
      // Somebody's effective permissions may have just changed.
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      toast.success(isEdit ? 'Role updated' : 'Role created');
      onOpenChange(false);
    },
    onError: (error) => {
      setFormError(
        applyFieldErrors(error, setError, {
          knownFields: ['name', 'description'],
          fallback: 'Could not save this role.',
        }),
      );
    },
  });

  // The super-admin role holds everything by definition; the API refuses to edit
  // its grants, so the matrix is shown read-only rather than accepting changes
  // that would be rejected on submit.
  const permissionsLocked = role?.slug === 'super_admin';

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      size="full"
      title={isEdit ? `Edit ${role?.name}` : 'Add a role'}
      description="A role is a named set of permissions. Users get their access from the roles assigned to them."
      onSubmit={handleSubmit((values) => {
        if (selected.size === 0) {
          setFormError('Grant at least one permission.');
          return;
        }
        mutation.mutate(values);
      })}
      submitLabel={isEdit ? 'Save changes' : 'Create role'}
      isSubmitting={isSubmitting || mutation.isPending}
    >
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

      {role?.isSystem ? (
        <FormAlert tone="info">
          This is a seeded system role. Its name cannot be changed and it cannot be deleted, but
          its permissions stay editable.
        </FormAlert>
      ) : null}

      <FormGrid>
        <FormField label="Name" error={errors.name?.message} required>
          {(props) => (
            <Input {...props} {...register('name')} disabled={role?.isSystem} autoComplete="off" />
          )}
        </FormField>

        <FormField label="Description" error={errors.description?.message}>
          {(props) => <Input {...props} {...register('description')} autoComplete="off" />}
        </FormField>
      </FormGrid>

      <FormSection
        title="Permissions"
        description={`${selected.size} granted. Every checkbox here corresponds to a guard on an API route.`}
      >
        {catalog.isLoading ? (
          <LoadingState variant="inline" label="Loading the permission catalog…" />
        ) : catalog.data ? (
          <PermissionMatrix
            catalog={catalog.data}
            selected={selected}
            onChange={setSelected}
            disabled={permissionsLocked}
          />
        ) : (
          <FormAlert tone="error">Could not load the permission catalog.</FormAlert>
        )}
      </FormSection>
    </FormModal>
  );
};
