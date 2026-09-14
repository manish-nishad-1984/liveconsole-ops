import { zodResolver } from '@hookform/resolvers/zod';
import { REGEX, formatCurrency } from '@liveconsole-ops/shared';
import { RENT_BASES, type VehicleRentalDto } from '@liveconsole-ops/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { FormAlert } from '@/components/common/FormAlert';
import { FormField } from '@/components/common/FormField';
import { FormGrid, FormModal, FormSection } from '@/components/common/FormModal';
import { OptionSelect } from '@/components/common/OptionSelect';
import { Segmented } from '@/components/common/Segmented';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useEmployeeOptions, useSiteOptions } from '@/hooks/use-options';
import { useCan } from '@/hooks/use-permissions';
import { RENT_BASIS_LABELS } from '@/lib/labels';
import { queryKeys } from '@/lib/query-client';
import { QuickAddDialogs, useQuickAdd } from '@/pages/quick-add/QuickAddDialogs';
import { rentDays } from '@/pages/vehicle-rentals/rent';
import { vehicleRentalsService } from '@/services/transport.service';
import { useAuthStore } from '@/store/auth.store';
import { todayIso } from '@/utils/dates';
import { applyFieldErrors } from '@/utils/errors';

const money = /^\d{1,10}(\.\d{1,2})?$/;
const optionalMobile = z
  .string()
  .trim()
  .refine((value) => value === '' || REGEX.PHONE.test(value), 'Enter a 10-digit mobile number');

const schema = z
  .object({
    employeeId: z.string(),
    siteId: z.string(),
    vehicleType: z.string().trim().min(1, 'Say what vehicle it is').max(60),
    vehicleNumber: z.string().trim().max(20),
    vendorName: z.string().trim().min(1, 'Who is it hired from?').max(120),
    vendorMobile: optionalMobile,
    driverName: z.string().trim().max(120),
    driverMobile: optionalMobile,
    fromDate: z.string().min(1, 'Choose the start date'),
    stillOnRent: z.boolean(),
    toDate: z.string(),
    rentBasis: z.enum(RENT_BASES),
    rate: z
      .string()
      .trim()
      .regex(money, 'Enter an amount like 1500 or 1500.50')
      .refine((value) => Number(value) > 0, 'Rent must be more than zero'),
    extraCharges: z
      .string()
      .trim()
      .refine((value) => value === '' || money.test(value), 'Enter an amount like 500'),
    notes: z.string().trim().max(500),
  })
  .refine((data) => data.stillOnRent || data.toDate !== '', {
    message: 'Choose the end date, or tick "Still on rent"',
    path: ['toDate'],
  })
  .refine((data) => data.stillOnRent || !data.toDate || data.toDate >= data.fromDate, {
    message: 'The end date cannot be before the start date',
    path: ['toDate'],
  });

type RentalForm = z.infer<typeof schema>;

const DATALIST_TYPES = 'vehicle-type-suggestions';
const DATALIST_VENDORS = 'vendor-suggestions';

export interface RentalFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: VehicleRentalDto | null;
  onSaved?: (rental: VehicleRentalDto) => void;
}

/**
 * Add / edit a hired vehicle. The rent works itself out as the dates and rate are
 * filled in, so what is saved is what the employee saw.
 */
export const RentalFormModal = ({ open, onOpenChange, rental, onSaved }: RentalFormModalProps) => {
  const queryClient = useQueryClient();
  const me = useAuthStore((state) => state.user);
  const canManage = useCan('transport:manage');
  const quickAdd = useQuickAdd();
  const [formError, setFormError] = useState<string | null>(null);

  const sites = useSiteOptions(open);
  const employees = useEmployeeOptions(open && canManage);
  const suggestions = useQuery({
    queryKey: queryKeys.transport.suggestions,
    queryFn: () => vehicleRentalsService.suggestions(),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<RentalForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: '',
      siteId: '',
      vehicleType: '',
      vehicleNumber: '',
      vendorName: '',
      vendorMobile: '',
      driverName: '',
      driverMobile: '',
      fromDate: todayIso(),
      stillOnRent: true,
      toDate: '',
      rentBasis: 'PER_DAY',
      rate: '',
      extraCharges: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      employeeId: rental?.employee.id ?? me?.id ?? '',
      siteId: rental?.site?.id ?? '',
      vehicleType: rental?.vehicleType ?? '',
      vehicleNumber: rental?.vehicleNumber ?? '',
      vendorName: rental?.vendorName ?? '',
      vendorMobile: rental?.vendorMobile ?? '',
      driverName: rental?.driverName ?? '',
      driverMobile: rental?.driverMobile ?? '',
      fromDate: rental?.fromDate ?? todayIso(),
      stillOnRent: rental ? rental.toDate === null : true,
      toDate: rental?.toDate ?? '',
      rentBasis: rental?.rentBasis ?? 'PER_DAY',
      rate: rental?.rate ?? '',
      extraCharges: rental && Number(rental.extraCharges) > 0 ? rental.extraCharges : '',
      notes: rental?.notes ?? '',
    });
    setFormError(null);
  }, [open, rental, me?.id, reset]);

  const mutation = useMutation({
    mutationFn: (values: RentalForm) => {
      const payload = {
        ...(canManage && values.employeeId ? { employeeId: values.employeeId } : {}),
        siteId: values.siteId || null,
        vehicleType: values.vehicleType,
        vehicleNumber: values.vehicleNumber || null,
        vendorName: values.vendorName,
        vendorMobile: values.vendorMobile || null,
        driverName: values.driverName || null,
        driverMobile: values.driverMobile || null,
        fromDate: values.fromDate,
        toDate: values.stillOnRent ? null : values.toDate,
        rentBasis: values.rentBasis,
        rate: values.rate,
        extraCharges: values.extraCharges || '0',
        notes: values.notes || null,
      };
      return rental
        ? vehicleRentalsService.update(rental.id, payload)
        : vehicleRentalsService.create(payload);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.transport.all });
      toast.success(rental ? `${saved.rentalNo} updated` : `${saved.rentalNo} added`);
      onSaved?.(saved);
      onOpenChange(false);
    },
    onError: (error) =>
      setFormError(
        applyFieldErrors(error, setError, {
          knownFields: [
            'siteId',
            'vehicleType',
            'vehicleNumber',
            'vendorName',
            'vendorMobile',
            'driverName',
            'driverMobile',
            'fromDate',
            'toDate',
            'rate',
            'extraCharges',
            'notes',
          ],
          fallback: 'Could not save this vehicle.',
        }),
      ),
  });

  const rentBasis = watch('rentBasis');
  const stillOnRent = watch('stillOnRent');
  const fromDate = watch('fromDate');
  const toDate = watch('toDate');
  const rate = Number(watch('rate')) || 0;
  const extra = Number(watch('extraCharges')) || 0;
  const days = rentDays(fromDate, stillOnRent ? null : toDate || null);
  const total = (rentBasis === 'PER_DAY' ? rate * days : rate) + extra;

  // Picking a known vendor fills in their number, if it is still blank.
  const fillVendorMobile = (name: string) => {
    if (getValues('vendorMobile')) return;
    const match = suggestions.data?.vendors.find(
      (vendor) => vendor.name.toLowerCase() === name.trim().toLowerCase(),
    );
    if (match?.mobile) setValue('vendorMobile', match.mobile);
  };

  return (
    <>
      <FormModal
        open={open}
        onOpenChange={onOpenChange}
        title={rental ? `Edit ${rental.rentalNo}` : 'Add a hired vehicle'}
        description="A vehicle taken on rent for a site. Record payments against it once saved."
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        submitLabel={rental ? 'Save changes' : 'Add vehicle'}
        isSubmitting={mutation.isPending}
        size="lg"
      >
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

        <FormGrid>
          {canManage ? (
            <FormField label="In charge" hint="Employee responsible — they see this record.">
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

          <FormField label="Site" error={errors.siteId?.message} hint="Optional." full={!canManage}>
            {(props) => (
              <OptionSelect
                id={props.id}
                options={sites.data}
                value={watch('siteId') || null}
                onChange={(value) => setValue('siteId', value ?? '')}
                emptyLabel="No site"
                onAddNew={quickAdd.addNew('site')}
                addNewLabel="Add new site"
              />
            )}
          </FormField>

          <FormField label="Vehicle" error={errors.vehicleType?.message} required>
            {(props) => (
              <Input
                {...props}
                {...register('vehicleType')}
                list={DATALIST_TYPES}
                placeholder="e.g. Tempo, Truck, JCB, Car"
                autoComplete="off"
              />
            )}
          </FormField>

          <FormField label="Vehicle number" error={errors.vehicleNumber?.message}>
            {(props) => (
              <Input
                {...props}
                {...register('vehicleNumber')}
                placeholder="GJ 01 AB 1234"
                className="uppercase"
                autoComplete="off"
              />
            )}
          </FormField>

          <FormField label="Hired from" error={errors.vendorName?.message} required>
            {(props) => (
              <Input
                {...props}
                {...register('vendorName', {
                  onBlur: (event: { target: { value: string } }) =>
                    fillVendorMobile(event.target.value),
                })}
                list={DATALIST_VENDORS}
                placeholder="Owner or agency"
                autoComplete="off"
              />
            )}
          </FormField>

          <FormField label="Owner mobile" error={errors.vendorMobile?.message}>
            {(props) => (
              <Input {...props} {...register('vendorMobile')} inputMode="tel" autoComplete="off" />
            )}
          </FormField>

          <FormField label="Driver" error={errors.driverName?.message}>
            {(props) => <Input {...props} {...register('driverName')} autoComplete="off" />}
          </FormField>

          <FormField label="Driver mobile" error={errors.driverMobile?.message}>
            {(props) => (
              <Input {...props} {...register('driverMobile')} inputMode="tel" autoComplete="off" />
            )}
          </FormField>
        </FormGrid>

        <FormSection title="Period and rent">
          <FormGrid>
            <FormField label="From" error={errors.fromDate?.message} required>
              {(props) => <Input {...props} {...register('fromDate')} type="date" />}
            </FormField>

            <FormField label="To" error={errors.toDate?.message}>
              {(props) => (
                <div className="space-y-1.5">
                  <Input
                    {...props}
                    {...register('toDate')}
                    type="date"
                    min={fromDate}
                    disabled={stillOnRent}
                  />
                  <label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={stillOnRent}
                      onCheckedChange={(checked) =>
                        setValue('stillOnRent', checked === true, { shouldValidate: true })
                      }
                    />
                    Still on rent
                  </label>
                </div>
              )}
            </FormField>

            <FormField label="Rent" full>
              {() => (
                <Segmented
                  value={rentBasis}
                  options={RENT_BASES}
                  labels={RENT_BASIS_LABELS}
                  onChange={(next) => setValue('rentBasis', next)}
                />
              )}
            </FormField>

            <FormField
              label={rentBasis === 'PER_DAY' ? 'Rate per day (₹)' : 'Total rent (₹)'}
              error={errors.rate?.message}
              required
            >
              {(props) => (
                <Input
                  {...props}
                  {...register('rate')}
                  inputMode="decimal"
                  placeholder="0.00"
                  autoComplete="off"
                />
              )}
            </FormField>

            <FormField
              label="Extra charges (₹)"
              error={errors.extraCharges?.message}
              hint="Diesel, driver allowance, loading."
            >
              {(props) => (
                <Input
                  {...props}
                  {...register('extraCharges')}
                  inputMode="decimal"
                  placeholder="0"
                  autoComplete="off"
                />
              )}
            </FormField>
          </FormGrid>

          {rate > 0 ? (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {rentBasis === 'PER_DAY'
                  ? `${days} day${days === 1 ? '' : 's'}${stillOnRent ? ' so far' : ''} × ${formatCurrency(rate)}`
                  : 'Fixed rent'}
                {extra > 0 ? ` + ${formatCurrency(extra)} extra` : ''} ={' '}
              </span>
              <span className="numeric font-semibold">{formatCurrency(total)}</span>
            </div>
          ) : null}
        </FormSection>

        <FormField label="Notes" error={errors.notes?.message} full>
          {(props) => <Textarea {...props} {...register('notes')} rows={2} />}
        </FormField>

        <datalist id={DATALIST_TYPES}>
          {(suggestions.data?.vehicleTypes ?? []).map((type) => (
            <option key={type} value={type} />
          ))}
        </datalist>
        <datalist id={DATALIST_VENDORS}>
          {(suggestions.data?.vendors ?? []).map((vendor) => (
            <option key={vendor.name} value={vendor.name}>
              {vendor.mobile ?? ''}
            </option>
          ))}
        </datalist>
      </FormModal>

      <QuickAddDialogs
        adding={quickAdd.adding}
        onClose={quickAdd.close}
        onAdded={(kind, id) => {
          if (kind === 'site') setValue('siteId', id);
          if (kind === 'employee') setValue('employeeId', id);
        }}
      />
    </>
  );
};
