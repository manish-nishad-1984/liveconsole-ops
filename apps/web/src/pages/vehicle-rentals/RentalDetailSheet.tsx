import { formatCurrency } from '@liveconsole-ops/shared';
import type { RentPaymentDto, VehicleRentalDto } from '@liveconsole-ops/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IndianRupee, Pencil, Phone, Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useCan } from '@/hooks/use-permissions';
import { PAYMENT_MODE_LABELS, RENT_BASIS_LABELS, RENT_SOURCE_LABELS } from '@/lib/labels';
import { queryKeys } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { PaymentFormModal } from '@/pages/vehicle-rentals/PaymentFormModal';
import {
  PAYMENT_STATUS_LABELS,
  RENTAL_STATUS_LABELS,
  paymentStatusTone,
} from '@/pages/vehicle-rentals/rent';
import { vehicleRentalsService } from '@/services/transport.service';
import { formatDateOnly } from '@/utils/dates';

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-start justify-between gap-4 py-2 text-sm">
    <dt className="shrink-0 text-muted-foreground">{label}</dt>
    <dd className="min-w-0 text-right font-medium">{children}</dd>
  </div>
);

const Figure = ({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) => (
  <div className="rounded-md border border-border px-3 py-2">
    <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className={cn('numeric text-base font-semibold', className)}>{value}</p>
  </div>
);

const PhoneLink = ({ number }: { number: string | null }) =>
  number ? (
    <a href={`tel:${number}`} className="inline-flex items-center gap-1 text-primary">
      <Phone className="size-3" />
      {number}
    </a>
  ) : null;

export interface RentalDetailSheetProps {
  rentalId: string | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (rental: VehicleRentalDto) => void;
  onDelete: (rental: VehicleRentalDto) => void;
}

/** One hired vehicle: what it costs, what has been paid and by whom. */
export const RentalDetailSheet = ({
  rentalId,
  onOpenChange,
  onEdit,
  onDelete,
}: RentalDetailSheetProps) => {
  const queryClient = useQueryClient();
  const canDelete = useCan('transport:delete');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<RentPaymentDto | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<RentPaymentDto | null>(null);

  const query = useQuery({
    queryKey: queryKeys.transport.detail(rentalId ?? ''),
    queryFn: () => vehicleRentalsService.getById(rentalId!),
    enabled: Boolean(rentalId),
  });

  const deletePayment = useMutation({
    mutationFn: (payment: RentPaymentDto) =>
      vehicleRentalsService.removePayment(rentalId!, payment.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.transport.all });
      setConfirmDelete(null);
      toast.success('Payment deleted');
    },
  });

  const rental = query.data;
  const pending = Number(rental?.pendingAmount ?? 0);

  return (
    <>
      <Sheet open={Boolean(rentalId)} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {query.isLoading ? (
            <div className="p-5">
              <LoadingState variant="detail" />
            </div>
          ) : query.error ? (
            <div className="p-5">
              <ErrorState error={query.error} onRetry={() => void query.refetch()} />
            </div>
          ) : rental ? (
            <div className="flex min-h-full flex-col">
              <div className="space-y-2 border-b border-border px-5 pb-4 pt-5">
                <div className="flex flex-wrap items-center gap-2 pr-8">
                  <SheetTitle className="text-base">
                    {rental.vehicleType}
                    {rental.vehicleNumber ? (
                      <span className="numeric ml-1.5 text-muted-foreground">
                        {rental.vehicleNumber}
                      </span>
                    ) : null}
                  </SheetTitle>
                  <StatusBadge
                    status={rental.rentalStatus}
                    label={RENTAL_STATUS_LABELS[rental.rentalStatus]}
                  />
                  <StatusBadge
                    status={rental.paymentStatus}
                    label={PAYMENT_STATUS_LABELS[rental.paymentStatus]}
                    tone={paymentStatusTone(rental.paymentStatus)}
                  />
                </div>
                <p className="numeric text-xs text-muted-foreground">{rental.rentalNo}</p>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <Figure label="Rent" value={formatCurrency(rental.rentDue)} />
                  <Figure label="Paid" value={formatCurrency(rental.paidAmount)} />
                  <Figure
                    label={pending < 0 ? 'Advance' : 'Due'}
                    value={formatCurrency(Math.abs(pending))}
                    className={pending > 0 ? 'text-status-danger' : undefined}
                  />
                </div>
              </div>

              <div className="flex-1 space-y-5 px-5 py-4">
                <dl className="divide-y divide-border">
                  <Row label="In charge">{rental.employee.fullName}</Row>
                  <Row label="Site">{rental.site?.name ?? '—'}</Row>
                  <Row label="Hired from">
                    {rental.vendorName}
                    <span className="block text-2xs font-normal">
                      <PhoneLink number={rental.vendorMobile} />
                    </span>
                  </Row>
                  {rental.driverName || rental.driverMobile ? (
                    <Row label="Driver">
                      {rental.driverName ?? '—'}
                      <span className="block text-2xs font-normal">
                        <PhoneLink number={rental.driverMobile} />
                      </span>
                    </Row>
                  ) : null}
                  <Row label="Period">
                    {formatDateOnly(rental.fromDate)} –{' '}
                    {rental.toDate ? formatDateOnly(rental.toDate) : 'still on rent'}
                    <span className="block text-2xs font-normal text-muted-foreground">
                      {rental.days} day{rental.days === 1 ? '' : 's'}
                      {rental.toDate ? '' : ' so far'}
                    </span>
                  </Row>
                  <Row label="Rent">
                    {rental.rentBasis === 'PER_DAY'
                      ? `${formatCurrency(rental.rate)} per day`
                      : `${formatCurrency(rental.rate)} (${RENT_BASIS_LABELS.FIXED.toLowerCase()})`}
                    {Number(rental.extraCharges) > 0 ? (
                      <span className="block text-2xs font-normal text-muted-foreground">
                        + {formatCurrency(rental.extraCharges)} extra charges
                      </span>
                    ) : null}
                  </Row>
                  {rental.notes ? <Row label="Notes">{rental.notes}</Row> : null}
                </dl>

                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="section-label">Payments</h4>
                    {rental.canEdit ? (
                      <Button
                        size="sm"
                        variant={pending > 0 ? 'default' : 'outline'}
                        onClick={() => {
                          setEditingPayment(null);
                          setPaymentOpen(true);
                        }}
                      >
                        <Plus />
                        Add payment
                      </Button>
                    ) : null}
                  </div>

                  {rental.payments?.length ? (
                    <ul className="divide-y divide-border rounded-md border border-border">
                      {rental.payments.map((payment) => (
                        <li key={payment.id} className="flex items-start gap-3 px-3 py-2.5">
                          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                            <IndianRupee className="size-3.5" />
                          </span>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="numeric text-sm font-semibold">
                              {formatCurrency(payment.amount)}
                            </p>
                            <p className="text-2xs text-muted-foreground">
                              {formatDateOnly(payment.paymentDate)} ·{' '}
                              {PAYMENT_MODE_LABELS[payment.paymentMode]} · {payment.paidBy.fullName}
                              {payment.referenceNo ? ` · ${payment.referenceNo}` : ''}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              <span className="text-2xs font-medium">
                                {RENT_SOURCE_LABELS[payment.source]}
                              </span>
                              {payment.expense ? (
                                <Link
                                  to={`/expenses?search=${encodeURIComponent(payment.expense.expenseNo)}`}
                                  className="inline-flex items-center gap-1 text-2xs text-primary"
                                >
                                  <span className="numeric">{payment.expense.expenseNo}</span>
                                </Link>
                              ) : null}
                            </div>
                            {payment.notes ? (
                              <p className="text-2xs text-muted-foreground">{payment.notes}</p>
                            ) : null}
                          </div>
                          {payment.canEdit ? (
                            <div className="flex shrink-0 items-center">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Edit payment"
                                onClick={() => {
                                  setEditingPayment(payment);
                                  setPaymentOpen(true);
                                }}
                              >
                                <Pencil />
                              </Button>
                              {canDelete ? (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-destructive"
                                  aria-label="Delete payment"
                                  onClick={() => setConfirmDelete(payment)}
                                >
                                  <Trash2 />
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No payments recorded yet.</p>
                  )}
                </section>
              </div>

              {rental.canEdit ? (
                <div className="sticky bottom-0 flex items-center justify-end gap-1 border-t border-border bg-card px-5 py-3">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(rental)}>
                    <Pencil />
                    Edit
                  </Button>
                  {canDelete ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => onDelete(rental)}
                    >
                      <Trash2 />
                      Delete
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {rental ? (
        <PaymentFormModal
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          rental={rental}
          payment={editingPayment}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Delete this payment?"
        description={
          confirmDelete
            ? `${formatCurrency(confirmDelete.amount)} paid by ${confirmDelete.paidBy.fullName}.${confirmDelete.expense ? ` Its petty cash expense ${confirmDelete.expense.expenseNo} is deleted too.` : ''}`
            : undefined
        }
        confirmLabel="Delete payment"
        loading={deletePayment.isPending}
        onConfirm={() => {
          if (confirmDelete) deletePayment.mutate(confirmDelete);
        }}
      />
    </>
  );
};
