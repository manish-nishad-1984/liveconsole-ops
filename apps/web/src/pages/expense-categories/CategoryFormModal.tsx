import { zodResolver } from '@hookform/resolvers/zod';
import type { ExpenseCategoryDto } from '@liveconsole-ops/types';
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
import { queryKeys } from '@/lib/query-client';
import { expenseCategoriesService } from '@/services/masters.service';
import { applyFieldErrors } from '@/utils/errors';

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(80),
  description: z.string().trim().max(300),
  sortOrder: z.coerce.number().int().min(0, 'Use 0 or more').max(100000),
  isActive: z.boolean(),
});

type CategoryForm = z.infer<typeof schema>;

export interface CategoryFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: ExpenseCategoryDto | null;
  /** Called with the saved record — lets a picker select what was just added. */
  onSaved?: (saved: ExpenseCategoryDto) => void;
}

export const CategoryFormModal = ({
  open,
  onOpenChange,
  category,
  onSaved,
}: CategoryFormModalProps) => {
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
  } = useForm<CategoryForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', sortOrder: 0, isActive: true },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      name: category?.name ?? '',
      description: category?.description ?? '',
      sortOrder: category?.sortOrder ?? 0,
      isActive: category?.isActive ?? true,
    });
    setFormError(null);
  }, [open, category, reset]);

  const mutation = useMutation({
    mutationFn: (values: CategoryForm) => {
      const payload = { ...values, description: values.description || null };
      return category
        ? expenseCategoriesService.update(category.id, payload)
        : expenseCategoriesService.create(payload);
    },
    onSuccess: (saved) => {
      onSaved?.(saved);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.expenseCategories.all,
      });
      toast.success(category ? 'Category updated' : 'Category added');
      onOpenChange(false);
    },
    onError: (error) =>
      setFormError(
        applyFieldErrors(error, setError, {
          knownFields: ['name', 'description', 'sortOrder'],
          fallback: 'Could not save this category.',
        }),
      ),
  });

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={category ? `Edit ${category.name}` : 'Add a category'}
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      submitLabel={category ? 'Save changes' : 'Add category'}
      isSubmitting={mutation.isPending}
      size="md"
    >
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      <FormGrid>
        <FormField label="Name" error={errors.name?.message} required>
          {(props) => <Input {...props} {...register('name')} autoComplete="off" />}
        </FormField>
        <FormField label="Order" error={errors.sortOrder?.message} hint="Lower shows first.">
          {(props) => (
            <Input {...props} {...register('sortOrder')} type="number" inputMode="numeric" />
          )}
        </FormField>
        <FormField label="Description" error={errors.description?.message} full>
          {(props) => <Input {...props} {...register('description')} />}
        </FormField>
      </FormGrid>
      {category ? (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={watch('isActive')}
            onCheckedChange={(checked) => setValue('isActive', checked === true)}
          />
          Active — shown when adding expenses
        </label>
      ) : null}
    </FormModal>
  );
};
