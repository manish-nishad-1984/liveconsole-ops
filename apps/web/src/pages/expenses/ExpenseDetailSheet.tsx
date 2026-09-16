import { formatCurrency, formatDateTime } from '@liveconsole-ops/shared';
import type { ExpenseDto } from '@liveconsole-ops/types';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useCan } from '@/hooks/use-permissions';
import { PAYMENT_MODE_LABELS } from '@/lib/labels';
import { queryKeys } from '@/lib/query-client';
import { ReceiptGallery } from '@/pages/expenses/ReceiptGallery';
import { expensesService } from '@/services/petty-cash.service';
import { formatDateOnly } from '@/utils/dates';

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
 * One expense, with its receipts. There is no approval step — an expense counts
 * against the employee's balance as soon as it is filed — so this is a record to
 * read and correct, not a decision to make.
 */
export const ExpenseDetailSheet = ({
  expenseId,
  onOpenChange,
  onEdit,
  onDelete,
}: ExpenseDetailSheetProps) => {
  const canDelete = useCan('expenses:delete');

  const query = useQuery({
    queryKey: queryKeys.pettyCash.expense(expenseId ?? ''),
    queryFn: () => expensesService.getById(expenseId!),
    enabled: Boolean(expenseId),
  });

  const expense = query.data;

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
              <SheetTitle className="numeric text-base">{expense.expenseNo}</SheetTitle>
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
                <Row label="Filed">{formatDateTime(expense.createdAt)}</Row>
              </dl>

              <section className="space-y-2">
                <h4 className="section-label">Receipts</h4>
                <ReceiptGallery expenseId={expense.id} attachments={expense.attachments ?? []} />
              </section>
            </div>

            <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-border bg-card px-5 py-3">
              <div className="ml-auto flex items-center gap-1">
                {expense.canEdit ? (
                  <Button variant="ghost" size="sm" onClick={() => onEdit(expense)}>
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
