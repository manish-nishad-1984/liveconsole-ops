import { formatCurrency, formatDateTime } from '@liveconsole-ops/shared';
import type { ExpenseDto } from '@liveconsole-ops/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, RotateCcw, Trash2, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { ErrorState } from '@/components/common/ErrorState';
import { FormAlert } from '@/components/common/FormAlert';
import { LoadingState } from '@/components/common/LoadingState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/hooks/use-permissions';
import { PAYMENT_MODE_LABELS } from '@/lib/labels';
import { queryKeys } from '@/lib/query-client';
import { ReceiptGallery } from '@/pages/expenses/ReceiptGallery';
import { expensesService } from '@/services/petty-cash.service';
import { formatDateOnly } from '@/utils/dates';

/** Pending expenses get the attention colour; everywhere else the defaults apply. */
export const expenseStatusTone = (status: ExpenseDto['status']) =>
  status === 'PENDING' ? ('warning' as const) : undefined;

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-start justify-between gap-4 py-2 text-sm">
    <dt className="shrink-0 text-muted-foreground">{label}</dt>
    <dd className="min-w-0 text-right font-medium">{children}</dd>
  </div>
);

export interface ExpenseDetailSheetProps {
  expenseId: string | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (expense: ExpenseDto) => void;
  onDelete: (expense: ExpenseDto) => void;
}

/**
 * One expense, with its receipts and the review actions. This is where an
 * approver actually tallies a bill against what was claimed, so the receipts are
 * on the same screen as the Approve button.
 */
export const ExpenseDetailSheet = ({
  expenseId,
  onOpenChange,
  onEdit,
  onDelete,
}: ExpenseDetailSheetProps) => {
  const queryClient = useQueryClient();
  const canApprove = useCan('expenses:approve');
  const canDelete = useCan('expenses:delete');
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    setNote('');
    setRejecting(false);
  }, [expenseId]);

  const query = useQuery({
    queryKey: queryKeys.pettyCash.expense(expenseId ?? ''),
    queryFn: () => expensesService.getById(expenseId!),
    enabled: Boolean(expenseId),
  });

  const onReviewed = (message: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.pettyCash.all });
    toast.success(message);
    setNote('');
    setRejecting(false);
  };

  const approve = useMutation({
    mutationFn: () => expensesService.approve(expenseId!, note.trim() || null),
    onSuccess: (expense) => onReviewed(`${expense.expenseNo} approved`),
  });

  const reject = useMutation({
    mutationFn: () => expensesService.reject(expenseId!, note.trim()),
    onSuccess: (expense) => onReviewed(`${expense.expenseNo} rejected`),
  });

  const reopen = useMutation({
    mutationFn: () => expensesService.reopen(expenseId!),
    onSuccess: (expense) => onReviewed(`${expense.expenseNo} moved back to pending`),
  });

  const expense = query.data;
  const busy = approve.isPending || reject.isPending || reopen.isPending;

  return (
    <Sheet open={Boolean(expenseId)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {query.isLoading ? (
          <div className="p-5">
            <LoadingState variant="detail" />
          </div>
        ) : query.error ? (
          <div className="p-5">
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          </div>
        ) : expense ? (
          <div className="flex min-h-full flex-col">
            <div className="space-y-2 border-b border-border px-5 pb-4 pt-5">
              <div className="flex items-center gap-2 pr-8">
                <SheetTitle className="numeric text-base">{expense.expenseNo}</SheetTitle>
                <StatusBadge status={expense.status} tone={expenseStatusTone(expense.status)} />
              </div>
              <p className="numeric text-2xl font-semibold">{formatCurrency(expense.amount)}</p>
              <p className="text-sm text-muted-foreground">
                {expense.description || expense.category.name}
              </p>
            </div>

            <div className="flex-1 space-y-5 px-5 py-4">
              <dl className="divide-y divide-border">
                <Row label="Employee">{expense.employee.fullName}</Row>
                <Row label="Date">{formatDateOnly(expense.expenseDate)}</Row>
                <Row label="Site">{expense.site?.name ?? '—'}</Row>
                <Row label="Category">{expense.category.name}</Row>
                {expense.rentPayment ? (
                  <Row label="Vehicle rent">
                    <Link
                      to={`/vehicle-rentals?view=${expense.rentPayment.rentalId}`}
                      className="numeric text-primary"
                    >
                      {expense.rentPayment.rentalNo}
                    </Link>
                    <span className="block text-2xs font-normal text-muted-foreground">
                      Edit or delete it from the rental
                    </span>
                  </Row>
                ) : null}
                {/* Both are optional now, so a row is shown only when it has something to say. */}
                {expense.description ? <Row label="Remark">{expense.description}</Row> : null}
                {expense.paidTo ? <Row label="Paid to">{expense.paidTo}</Row> : null}
                <Row label="Paid by">{PAYMENT_MODE_LABELS[expense.paymentMode]}</Row>
                <Row label="Submitted">{formatDateTime(expense.createdAt)}</Row>
                {expense.reviewedBy ? (
                  <Row label={expense.status === 'REJECTED' ? 'Rejected by' : 'Approved by'}>
                    {expense.reviewedBy.fullName}
                    <span className="block text-2xs font-normal text-muted-foreground">
                      {formatDateTime(expense.reviewedAt)}
                    </span>
                  </Row>
                ) : null}
              </dl>

              {expense.reviewNote ? (
                <FormAlert
                  tone={expense.status === 'REJECTED' ? 'error' : 'info'}
                  title="Review note"
                >
                  {expense.reviewNote}
                </FormAlert>
              ) : null}

              <section className="space-y-2">
                <h4 className="section-label">Receipts</h4>
                <ReceiptGallery expenseId={expense.id} attachments={expense.attachments ?? []} />
              </section>

              {canApprove && expense.status === 'PENDING' ? (
                <section className="space-y-2">
                  <Label htmlFor="review-note">
                    {rejecting ? 'Why is it rejected?' : 'Note (optional)'}
                  </Label>
                  <Textarea
                    id="review-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={2}
                    placeholder={rejecting ? 'e.g. Bill amount does not match' : ''}
                  />
                </section>
              ) : null}
            </div>

            <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-border bg-card px-5 py-3">
              {canApprove && expense.status === 'PENDING' ? (
                rejecting ? (
                  <>
                    <Button
                      variant="destructive"
                      loading={reject.isPending}
                      disabled={!note.trim() || busy}
                      onClick={() => reject.mutate()}
                    >
                      <X />
                      Confirm reject
                    </Button>
                    <Button variant="ghost" onClick={() => setRejecting(false)} disabled={busy}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      loading={approve.isPending}
                      disabled={busy}
                      onClick={() => approve.mutate()}
                    >
                      <Check />
                      Approve
                    </Button>
                    <Button variant="outline" disabled={busy} onClick={() => setRejecting(true)}>
                      <X />
                      Reject
                    </Button>
                  </>
                )
              ) : null}

              {canApprove && expense.status !== 'PENDING' ? (
                <Button
                  variant="outline"
                  loading={reopen.isPending}
                  disabled={busy}
                  onClick={() => reopen.mutate()}
                >
                  <RotateCcw />
                  Move back to pending
                </Button>
              ) : null}

              <div className="ml-auto flex items-center gap-1">
                {expense.canEdit ? (
                  <Button variant="ghost" size="sm" onClick={() => onEdit(expense)} disabled={busy}>
                    <Pencil />
                    Edit
                  </Button>
                ) : null}
                {expense.canEdit && canDelete ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => onDelete(expense)}
                    disabled={busy}
                  >
                    <Trash2 />
                    Delete
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};
