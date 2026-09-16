import { zodResolver } from '@hookform/resolvers/zod';
import { formatCurrency } from '@liveconsole-ops/shared';
import { PAYMENT_MODES, type AttachmentDto, type ExpenseDto } from '@liveconsole-ops/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Paperclip, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { FormAlert } from '@/components/common/FormAlert';
import { FormField } from '@/components/common/FormField';
import { FormGrid, FormModal, FormSection } from '@/components/common/FormModal';
import { OptionSelect } from '@/components/common/OptionSelect';
import { Segmented } from '@/components/common/Segmented';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCategoryOptions, useEmployeeOptions, useSiteOptions } from '@/hooks/use-options';
import { useCan } from '@/hooks/use-permissions';
import { formatFileSize, prepareUpload } from '@/lib/image';
import { PAYMENT_MODE_LABELS } from '@/lib/labels';
import { queryKeys } from '@/lib/query-client';
import { ReceiptGallery } from '@/pages/expenses/ReceiptGallery';
import { QuickAddDialogs, useQuickAdd } from '@/pages/quick-add/QuickAddDialogs';
import { expensesService } from '@/services/petty-cash.service';
import { useAuthStore } from '@/store/auth.store';
import { todayIso } from '@/utils/dates';
import { applyFieldErrors, getErrorMessage } from '@/utils/errors';

/**
 * Add / edit an expense, with its receipts.
 *
 * Built for a phone at site: the camera button opens the camera directly, photos
 * are shrunk before upload, and receipts picked before saving are uploaded right
 * after the expense is created — one screen, one Save.
 */

const MAX_RECEIPTS = 5;

const schema = z.object({
  employeeId: z.string(),
  expenseDate: z.string().min(1, 'Choose the date'),
  /** Optional — empty means the expense is not for one site. */
  siteId: z.string(),
  categoryId: z.string().min(1, 'Choose a category'),
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Enter an amount like 450 or 450.50')
    .refine((value) => Number(value) > 0, 'Amount must be more than zero'),
  paymentMode: z.enum(PAYMENT_MODES),
  /** "Remark" on screen — optional; the category already says what it was for. */
  description: z.string().trim().max(500),
});

type ExpenseForm = z.infer<typeof schema>;

export interface ExpenseFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: ExpenseDto | null;
}

export const ExpenseFormModal = ({ open, onOpenChange, expense }: ExpenseFormModalProps) => {
  const queryClient = useQueryClient();
  const me = useAuthStore((state) => state.user);
  const canManage = useCan('expenses:manage');
  const [formError, setFormError] = useState<string | null>(null);
  const [queued, setQueued] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const quickAdd = useQuickAdd();
  const sites = useSiteOptions(open);
  const categories = useCategoryOptions(open);
  const employees = useEmployeeOptions(open && canManage);

  // Existing receipts, when editing.
  const detail = useQuery({
    queryKey: queryKeys.pettyCash.expense(expense?.id ?? ''),
    queryFn: () => expensesService.getById(expense!.id),
    enabled: open && Boolean(expense),
  });
  const existingReceipts = detail.data?.attachments ?? [];

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ExpenseForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: '',
      expenseDate: todayIso(),
      siteId: '',
      categoryId: '',
      amount: '',
      paymentMode: 'CASH',
      description: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      employeeId: expense?.employee.id ?? me?.id ?? '',
      expenseDate: expense?.expenseDate ?? todayIso(),
      siteId: expense?.site?.id ?? '',
      categoryId: expense?.category.id ?? '',
      amount: expense?.amount ?? '',
      paymentMode: expense?.paymentMode ?? 'CASH',
      description: expense?.description ?? '',
    });
    setQueued([]);
    setFormError(null);
  }, [open, expense, me?.id, reset]);

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_RECEIPTS - existingReceipts.length - queued.length;
    const accepted = [...files].slice(0, Math.max(0, room));
    if (accepted.length < files.length) {
      toast.warning(`An expense can have at most ${MAX_RECEIPTS} receipts`);
    }
    setQueued((current) => [...current, ...accepted]);
  };

  const uploadQueued = async (expenseId: string): Promise<number> => {
    let failed = 0;
    for (const file of queued) {
      try {
        const prepared = await prepareUpload(file);
        await expensesService.uploadReceipt(expenseId, prepared.blob, prepared.fileName);
      } catch (error) {
        failed += 1;
        toast.error(`Could not upload ${file.name}`, {
          description: getErrorMessage(error),
        });
      }
    }
    return failed;
  };

  const removeReceipt = useMutation({
    mutationFn: (attachment: AttachmentDto) =>
      expensesService.removeReceipt(expense!.id, attachment.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pettyCash.all });
      toast.success('Receipt removed');
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: ExpenseForm) => {
      const payload = {
        ...(canManage && values.employeeId ? { employeeId: values.employeeId } : {}),
        expenseDate: values.expenseDate,
        siteId: values.siteId || null,
        categoryId: values.categoryId,
        amount: values.amount,
        paymentMode: values.paymentMode,
        // `paidTo` is not on this form; leaving it out keeps whatever an older
        // expense already has rather than clearing it.
        description: values.description || null,
      };
      const saved = expense
        ? await expensesService.update(expense.id, payload)
        : await expensesService.create(payload);

      if (queued.length > 0) {
        setUploading(true);
        try {
          const failed = await uploadQueued(saved.id);
          return { saved, failed };
        } finally {
          setUploading(false);
        }
      }
      return { saved, failed: 0 };
    },
    onSuccess: ({ saved, failed }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pettyCash.all });
      if (failed === 0) {
        toast.success(
          expense
            ? `${saved.expenseNo} updated`
            : `${saved.expenseNo} submitted — ${formatCurrency(saved.amount)}`,
        );
      } else {
        toast.warning(
          `${saved.expenseNo} saved, but ${failed} receipt(s) did not upload. Edit it to try again.`,
        );
      }
      onOpenChange(false);
    },
    onError: (error) =>
      setFormError(
        applyFieldErrors(error, setError, {
          knownFields: ['expenseDate', 'siteId', 'categoryId', 'amount', 'description'],
          fallback: 'Could not save this expense.',
        }),
      ),
  });

  const receiptCount = existingReceipts.length + queued.length;
  const busy = mutation.isPending || uploading;

  return (
    <>
      <FormModal
        open={open}
        onOpenChange={onOpenChange}
        title={expense ? `Edit ${expense.expenseNo}` : 'Add an expense'}
        description={
          expense?.status === 'REJECTED'
            ? 'Saving sends this expense for approval again.'
            : 'It goes to the office for approval. Attach a photo of the bill.'
        }
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        submitLabel={
          uploading ? 'Uploading receipts…' : expense ? 'Save changes' : 'Submit expense'
        }
        isSubmitting={busy}
        size="md"
      >
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
        {expense?.status === 'REJECTED' && expense.reviewNote ? (
          <FormAlert tone="warning" title="Rejected">
            {expense.reviewNote}
          </FormAlert>
        ) : null}

        <FormGrid>
          {canManage ? (
            <FormField label="Employee" hint="Who spent the money." full>
              {(props) => (
                <OptionSelect
                  id={props.id}
                  options={employees.data}
                  value={watch('employeeId') || null}
                  onChange={(value) => setValue('employeeId', value ?? '')}
                  onAddNew={quickAdd.addNew('employee')}
                  addNewLabel="Add new employee"
                />
              )}
            </FormField>
          ) : null}

          <FormField label="Amount" error={errors.amount?.message} required>
            {(props) => (
              <Input
                {...props}
                {...register('amount')}
                inputMode="decimal"
                placeholder="0.00"
                autoComplete="off"
              />
            )}
          </FormField>

          <FormField label="Date" error={errors.expenseDate?.message} required>
            {(props) => (
              <Input {...props} {...register('expenseDate')} type="date" max={todayIso()} />
            )}
          </FormField>

          <FormField label="Site" error={errors.siteId?.message} hint="Optional.">
            {(props) => (
              <OptionSelect
                id={props.id}
                invalid={props.invalid}
                options={sites.data}
                value={watch('siteId') || null}
                onChange={(value) => setValue('siteId', value ?? '', { shouldValidate: true })}
                emptyLabel="No site"
                onAddNew={quickAdd.addNew('site')}
                addNewLabel="Add new site"
              />
            )}
          </FormField>

          <FormField label="Category" error={errors.categoryId?.message} required full>
            {(props) => (
              <OptionSelect
                id={props.id}
                invalid={props.invalid}
                options={categories.data}
                value={watch('categoryId') || null}
                onChange={(value) => setValue('categoryId', value ?? '', { shouldValidate: true })}
                placeholder="Choose category"
                onAddNew={quickAdd.addNew('category')}
                addNewLabel="Add new category"
              />
            )}
          </FormField>

          <FormField
            label="Remark"
            error={errors.description?.message}
            hint="Optional — anything the category does not already say."
            full
          >
            {(props) => (
              <Textarea
                {...props}
                {...register('description')}
                rows={2}
                placeholder="e.g. Diesel for generator, tea for crew"
              />
            )}
          </FormField>

          <FormField label="Paid by">
            {() => (
              <Segmented
                value={watch('paymentMode')}
                options={PAYMENT_MODES}
                labels={PAYMENT_MODE_LABELS}
                onChange={(next) => setValue('paymentMode', next)}
              />
            )}
          </FormField>
        </FormGrid>

        <FormSection
          title={`Receipts (${receiptCount}/${MAX_RECEIPTS})`}
          description="Photo of the bill or a PDF."
        >
          {expense && existingReceipts.length > 0 ? (
            <ReceiptGallery
              expenseId={expense.id}
              attachments={existingReceipts}
              onRemove={(attachment) => removeReceipt.mutate(attachment)}
            />
          ) : null}

          {queued.length > 0 ? (
            <ul className="space-y-1.5">
              {queued.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs"
                >
                  <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <span className="shrink-0 text-2xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-6"
                    disabled={busy}
                    onClick={() => setQueued((current) => current.filter((_, i) => i !== index))}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          {receiptCount < MAX_RECEIPTS ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => cameraInput.current?.click()}
              >
                <Camera />
                Take photo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                <Paperclip />
                Choose file
              </Button>
              <input
                ref={cameraInput}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = '';
                }}
              />
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                multiple
                className="hidden"
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = '';
                }}
              />
            </div>
          ) : null}
        </FormSection>
      </FormModal>

      <QuickAddDialogs
        adding={quickAdd.adding}
        onClose={quickAdd.close}
        onAdded={(kind, id) => {
          if (kind === 'site') setValue('siteId', id, { shouldValidate: true });
          if (kind === 'category') setValue('categoryId', id, { shouldValidate: true });
          if (kind === 'employee') setValue('employeeId', id);
        }}
      />
    </>
  );
};
