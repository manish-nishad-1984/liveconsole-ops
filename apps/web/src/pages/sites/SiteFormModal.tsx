import { zodResolver } from '@hookform/resolvers/zod';
import type { SiteDto } from '@liveconsole-ops/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { FormAlert } from '@/components/common/FormAlert';
import { FormField } from '@/components/common/FormField';
import { FormGrid, FormModal } from '@/components/common/FormModal';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { queryKeys } from '@/lib/query-client';
import { sitesService } from '@/services/masters.service';
import { applyFieldErrors } from '@/utils/errors';

const schema = z.object({
  name: z.string().trim().min(1, 'Enter the site name').max(120),
  location: z.string().trim().max(180),
  clientName: z.string().trim().max(120),
  notes: z.string().trim().max(1000),
  isActive: z.boolean(),
});

type SiteForm = z.infer<typeof schema>;

export interface SiteFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site: SiteDto | null;
  /** Called with the saved record — lets a picker select what was just added. */
  onSaved?: (saved: SiteDto) => void;
}

export const SiteFormModal = ({ open, onOpenChange, site, onSaved }: SiteFormModalProps) => {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SiteForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      location: '',
      clientName: '',
      notes: '',
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      name: site?.name ?? '',
      location: site?.location ?? '',
      clientName: site?.clientName ?? '',
      notes: site?.notes ?? '',
      isActive: site?.isActive ?? true,
    });
    setFormError(null);
  }, [open, site, reset]);

  const mutation = useMutation({
    mutationFn: (values: SiteForm) => {
      const payload = {
        name: values.name,
        location: values.location || null,
        clientName: values.clientName || null,
        notes: values.notes || null,
        isActive: values.isActive,
      };
      return site ? sitesService.update(site.id, payload) : sitesService.create(payload);
    },
    onSuccess: (saved) => {
      onSaved?.(saved);
      void queryClient.invalidateQueries({ queryKey: queryKeys.sites.all });
      toast.success(site ? 'Site updated' : 'Site added');
      onOpenChange(false);
    },
    onError: (error) =>
      setFormError(
        applyFieldErrors(error, setError, {
          knownFields: ['name', 'location', 'clientName', 'notes'],
          fallback: 'Could not save this site.',
        }),
      ),
  });

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={site ? `Edit ${site.name}` : 'Add a site'}
      description="Expenses and vehicles are booked against sites."
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      submitLabel={site ? 'Save changes' : 'Add site'}
      isSubmitting={mutation.isPending}
      size="md"
    >
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      <FormGrid>
        <FormField label="Site name" error={errors.name?.message} required full>
          {(props) => <Input {...props} {...register('name')} autoComplete="off" />}
        </FormField>
        <FormField label="Location" error={errors.location?.message}>
          {(props) => <Input {...props} {...register('location')} placeholder="City / area" />}
        </FormField>
        <FormField label="Client" error={errors.clientName?.message}>
          {(props) => <Input {...props} {...register('clientName')} />}
        </FormField>
        <FormField label="Notes" error={errors.notes?.message} full>
          {(props) => <Textarea {...props} {...register('notes')} rows={2} />}
        </FormField>
      </FormGrid>
      {site ? (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={watch('isActive')}
            onCheckedChange={(checked) => setValue('isActive', checked === true)}
          />
          Active — shown in pickers
        </label>
      ) : null}
    </FormModal>
  );
};
