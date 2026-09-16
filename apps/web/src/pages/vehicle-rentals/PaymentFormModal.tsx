import { zodResolver } from '@hookform/resolvers/zod';
import { formatCurrency } from '@liveconsole-ops/shared';
import {
  PAYMENT_MODES,
  RENT_PAYMENT_SOURCES,
  type RentPaymentDto,
  type VehicleRentalDto,
} from '@liveconsole-ops/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { useEmployeeOptions } from '@/hooks/use-options';
import { useCan } from '@/hooks/use-permissions';
import { PAYMENT_MODE_LABELS, RENT_SOURCE_LABELS } from '@/lib/labels';
import { queryKeys } from '@/lib/query-client';
import { vehicleRentalsService } from '@/services/transport.service';
import { useAuthStore } from '@/store/auth.store';
import { todayIso } from '@/utils/dates';
import { applyFieldErrors } from '@/utils/errors';

const schema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Enter an amount like 5000 or 5000.50')
    .refine((value) => Number(value) > 0, 'Amount must be more than zero'),
  paymentDate: z.string().min(1, 'Choose the date'),
  paymentMode: z.enum(PAYMENT_MODES),
  source: z.enum(RENT_PAYMENT_SOURCES),
  paidById: z.string(),
  referenceNo: z.string().trim().max(80),
  notes: z.string().trim().max(500),
});

type PaymentForm = z.infer<typeof schema>;

export interface PaymentFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: VehicleRentalDto;
  payment: RentPaymentDto | null;
}

/**
 * Record rent paid for a vehicle. Paying from petty cash is the one choice with a
 * side effect — it files an expense for whoever paid — so the form says so.
 */
export const PaymentFormModal = ({
  open,
  onOpenChange,
  rental,
  payment,
}: PaymentFormModalProps) => {
  const queryClient = useQueryClient();
  const me = useAuthStore((state) => state.user);
  const canManage = useCan('transport:manage');
  const [formError, setFormError] = useState<string | null>(null);
  const employees = useEmployeeOptions(open && canManage);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PaymentForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: '',
      paymentDate: todayIso(),
      paymentMode: 'CASH',
      source: 'OFFICE',
      paidById: '',
      referenceNo: '',
      notes: '',
    },
  });

  // Office staff usually pay directly; site staff usually pay out of petty cash.
  const defaultSource = canManage ? 'OFFICE' : 'PETTY_CASH';
  const paidByFor = (source: PaymentForm['source']) =>
    source === 'PETTY_CASH' ? rental.employee.id : (me?.id ?? '');

  useEffect(() => {
    if (!open) return;
    const pending = Number(rental.pendingAmount);
    const source = payment?.source ?? defaultSource;
    reset({
      amount: payment?.amount ?? (pending > 0 ? rental.pendingAmount : ''),
      paymentDate: payment?.paymentDate ?? todayIso(),
      paymentMode: payment?.paymentMode ?? 'CASH',
      source,
      paidById: payment?.paidBy.id ?? paidByFor(source),
      referenceNo: payment?.referenceNo ?? '',
      notes: payment?.notes ?? '',
    });
    setFormError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the target changes
  }, [open, payment, rental.id, reset]);

  const mutation = useMutation({
    mutationFn: (values: PaymentForm) => {
      const payload = {
        paymentDate: values.paymentDate,
        amount: values.amount,
        paymentMode: values.paymentMode,
        source: values.source,
        ...(canManage && values.paidById ? { paidById: values.paidById } : {}),
        referenceNo: values.paymentMode === 'CASH' ? null : values.referenceNo || null,
        notes: values.notes || null,
      };
      return payment
        ? vehicleRentalsService.updatePayment(rental.id, payment.id, payload)
        : vehicleRentalsService.addPayment(rental.id, payload);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.transport.all });
      toast.success(
        payment
          ? 'Payment updated'
          : `${formatCurrency(watch('amount'))} recorded — ${formatCurrency(saved.pendingAmount)} still due`,
      );
      onOpenChange(false);
    },
    onError: (error) =>
      setFormError(
        applyFieldErrors(error, setError, {
          knownFields: ['amount', 'paymentDate', 'referenceNo', 'notes'],
          fallback: 'Could not save this payment.',
        }),
      ),
  });

  const source = watch('source');
  const paymentMode = watch('paymentMode');
  const paidById = watch('paidById');
  const payerName =
    paidById === me?.id
      ? 'you'
      : (employees.data?.find((option) => option.id === paidById)?.name ??
        (paidById === rental.employee.id ? rental.employee.fullName : 'the payer'));

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={payment ? 'Edit payment' : `Pay rent — ${rental.rentalNo}`}
      description={`${rental.vehicleType}${rental.vehicleNumber ? ` ${rental.vehicleNumber}` : ''} from ${rental.vendorName}. ${formatCurrency(rental.pendingAmount)} due now.`}
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      submitLabel={payment ? 'Save changes' : 'Record payment'}
      isSubmitting={mutation.isPending}
      size="md"
    >
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

      <FormGrid>
        <FormField label="Whose money?" full>
          {() => (
            <Segmented
              value={source}
              options={RENT_PAYMENT_SOURCES}
              labels={RENT_SOURCE_LABELS}
              onChange={(next) => {
                setValue('source', next);
                if (!payment) setValue('paidById', paidByFor(next));
              }}
            />
          )}
        </FormField>

        {canManage ? (
          <FormField label="Paid by" full>
            {(props) => (
              <OptionSelect
                id={props.id}
                options={employees.data}
                value={paidById || null}
                onChange={(value) => setValue('paidById', value ?? '')}
              />
            )}
          </FormField>
        ) : null}

        {source === 'PETTY_CASH' ? (
          <div className="sm:col-span-2">
            <FormAlert tone="info">
              This files a <strong>Vehicle Rent</strong> expense for {payerName}. It comes off their
              petty cash balance as an expense.
            </FormAlert>
          </div>
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

        <FormField label="Date" error={errors.paymentDate?.message} required>
          {(props) => (
            <Input {...props} {...register('paymentDate')} type="date" max={todayIso()} />
          )}
        </FormField>

        <FormField label="Mode" full>
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

        <FormField label="Notes" error={errors.notes?.message} full>
          {(props) => <Textarea {...props} {...register('notes')} rows={2} />}
        </FormField>
      </FormGrid>
    </FormModal>
  );
};
