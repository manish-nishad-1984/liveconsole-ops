import { zodResolver } from '@hookform/resolvers/zod';
import { formatCurrency } from '@liveconsole-ops/shared';
import {
  CASH_ENTRY_TYPES,
  PAYMENT_MODES,
  type CashEntryDto,
  type CashEntryType,
} from '@liveconsole-ops/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { FormAlert } from '@/components/common/FormAlert';
import { FormField } from '@/components/common/FormField';
import { FormGrid, FormModal } from '@/components/common/FormModal';
import { OptionSelect } from '@/components/common/OptionSelect';
import { Segmented } from '@/components/common/Segmented';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useEmployeeOptions, useSiteOptions } from '@/hooks/use-options';
import { useCan } from '@/hooks/use-permissions';
import { PAYMENT_MODE_LABELS } from '@/lib/labels';
import { queryKeys } from '@/lib/query-client';
import { QuickAddDialogs, useQuickAdd } from '@/pages/quick-add/QuickAddDialogs';
import { balancesService, cashBookService } from '@/services/petty-cash.service';
import { applyFieldErrors } from '@/utils/errors';
import { todayIso } from '@/utils/dates';

const TYPE_LABELS: Record<CashEntryType, string> = {
  GIVEN: 'Give cash',
  RETURNED: 'Cash returned',
};

const schema = z.object({
  type: z.enum(CASH_ENTRY_TYPES),
  employeeId: z.string().min(1, 'Choose the employee'),
  siteId: z.string().nullable(),
  entryDate: z.string().min(1, 'Choose the date'),
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Enter an amount like 5000 or 5000.50')
    .refine((value) => Number(value) > 0, 'Amount must be more than zero'),
  paymentMode: z.enum(PAYMENT_MODES),
  referenceNo: z.string().trim().max(80),
  notes: z.string().trim().max(500),
});

type CashForm = z.infer<typeof schema>;

export interface CashEntryFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: CashEntryDto | null;
  defaultEmployeeId?: string | null;
}

export const CashEntryFormModal = ({
  open,
  onOpenChange,
  entry,
  defaultEmployeeId,
}: CashEntryFormModalProps) => {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const quickAdd = useQuickAdd();
  const employees = useEmployeeOptions(open);
  const sites = useSiteOptions(open);
  const canSeeBalances = useCan('balances:manage');

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CashForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'GIVEN',
      employeeId: '',
      siteId: null,
      entryDate: todayIso(),
      amount: '',
      paymentMode: 'CASH',
      referenceNo: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      type: entry?.type ?? 'GIVEN',
      employeeId: entry?.employee.id ?? defaultEmployeeId ?? '',
      siteId: entry?.site?.id ?? null,
      entryDate: entry?.entryDate ?? todayIso(),
      amount: entry?.amount ?? '',
      paymentMode: entry?.paymentMode ?? 'CASH',
      referenceNo: entry?.referenceNo ?? '',
      notes: entry?.notes ?? '',
    });
    setFormError(null);
  }, [open, entry, defaultEmployeeId, reset]);

  const type = watch('type');
  const paymentMode = watch('paymentMode');
  const employeeId = watch('employeeId');

  // What the chosen employee holds right now — the number that matters when
  // deciding how much more to give, or how much they can return.
  const balances = useQuery({
    queryKey: queryKeys.pettyCash.balances({}),
    queryFn: () => balancesService.list({}),
    enabled: open && canSeeBalances,
  });
  const currentBalance = balances.data?.find((row) => row.employee.id === employeeId)?.balance;

  const mutation = useMutation({
    mutationFn: (values: CashForm) => {
      const payload = {
        ...values,
        siteId: values.siteId,
        referenceNo: values.referenceNo || null,
        notes: values.notes || null,
      };
      return entry ? cashBookService.update(entry.id, payload) : cashBookService.create(payload);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pettyCash.all });
      toast.success(
        entry
          ? `${saved.entryNo} updated`
          : `${saved.entryNo}: ${formatCurrency(saved.amount)} ${saved.type === 'GIVEN' ? 'given to' : 'returned by'} ${saved.employee.fullName}`,
      );
      onOpenChange(false);
    },
    onError: (error) =>
      setFormError(
        applyFieldErrors(error, setError, {
          knownFields: ['employeeId', 'entryDate', 'amount', 'referenceNo', 'notes'],
          fallback: 'Could not save this entry.',
        }),
      ),
  });

  return (
    <>
      <FormModal
        open={open}
        onOpenChange={onOpenChange}
        title={
          entry ? `Edit ${entry.entryNo}` : type === 'GIVEN' ? 'Give cash' : 'Record cash returned'
        }
        description={
          type === 'GIVEN'
            ? 'Money handed to an employee for site expenses.'
            : 'Unspent money an employee handed back.'
        }
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        submitLabel={entry ? 'Save changes' : 'Save entry'}
        isSubmitting={mutation.isPending}
        size="md"
      >
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

        <Segmented
          value={type}
          options={CASH_ENTRY_TYPES}
          labels={TYPE_LABELS}
          onChange={(next) => setValue('type', next)}
        />

        <FormGrid>
          <FormField
            label="Employee"
            error={errors.employeeId?.message}
            required
            full
            hint={
              currentBalance !== undefined
                ? `Currently holds ${formatCurrency(currentBalance)}`
                : undefined
            }
          >
            {(props) => (
              <OptionSelect
                id={props.id}
                invalid={props.invalid}
                options={employees.data}
                value={employeeId || null}
                onChange={(value) => setValue('employeeId', value ?? '', { shouldValidate: true })}
                placeholder="Choose employee"
                onAddNew={quickAdd.addNew('employee')}
                addNewLabel="Add new employee"
              />
            )}
          </FormField>

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

          <FormField label="Date" error={errors.entryDate?.message} required>
            {(props) => (
              <Input {...props} {...register('entryDate')} type="date" max={todayIso()} />
            )}
          </FormField>

          <FormField label="Paid by" full>
            {() => (
              <Segmented
                value={paymentMode}
                options={PAYMENT_MODES}
                labels={PAYMENT_MODE_LABELS}
                onChange={(next) => setValue('paymentMode', next)}
              />
            )}
          </FormField>

          {paymentMode !== 'CASH' ? (
            <FormField label="UPI / bank reference" error={errors.referenceNo?.message} full>
              {(props) => (
                <Input {...props} {...register('referenceNo')} placeholder="Transaction ID" />
              )}
            </FormField>
          ) : null}

          <FormField label="Site" hint="Optional — if the cash is for one site." full>
            {(props) => (
              <OptionSelect
                id={props.id}
                options={sites.data}
                value={watch('siteId')}
                onChange={(value) => setValue('siteId', value)}
                emptyLabel="Not for a specific site"
                onAddNew={quickAdd.addNew('site')}
                addNewLabel="Add new site"
              />
            )}
          </FormField>

          <FormField label="Notes" error={errors.notes?.message} full>
            {(props) => <Textarea {...props} {...register('notes')} rows={2} />}
          </FormField>
        </FormGrid>
      </FormModal>

      <QuickAddDialogs
        adding={quickAdd.adding}
        onClose={quickAdd.close}
        onAdded={(kind, id) => {
          if (kind === 'employee') setValue('employeeId', id, { shouldValidate: true });
          if (kind === 'site') setValue('siteId', id);
        }}
      />
    </>
  );
};
