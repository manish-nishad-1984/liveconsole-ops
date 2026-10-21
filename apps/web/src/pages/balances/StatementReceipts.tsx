import { useQuery } from '@tanstack/react-query';

import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { queryKeys } from '@/lib/query-client';
import { ReceiptGallery } from '@/pages/expenses/ReceiptGallery';
import { expensesService } from '@/services/petty-cash.service';

/**
 * The bills behind one statement line. Settling a statement is done line by
 * line, so the receipt opens over the statement rather than sending the reader
 * off to the expenses screen and back.
 *
 * Read-only on purpose: nothing is removed from here, whatever the caller may
 * do on the expense itself.
 */

export interface StatementReceiptsProps {
  expenseId: string | null;
  documentNo: string | null;
  onOpenChange: (open: boolean) => void;
}

export const StatementReceipts = ({
  expenseId,
  documentNo,
  onOpenChange,
}: StatementReceiptsProps) => {
  const query = useQuery({
    queryKey: queryKeys.pettyCash.expense(expenseId ?? ''),
    queryFn: () => expensesService.getById(expenseId!),
    enabled: Boolean(expenseId),
  });

  return (
    <Dialog open={Boolean(expenseId)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="text-sm">
          Receipts
          {documentNo ? <span className="numeric font-normal"> · {documentNo}</span> : null}
        </DialogTitle>

        {query.isLoading ? (
          <LoadingState variant="detail" />
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data ? (
          <ReceiptGallery expenseId={query.data.id} attachments={query.data.attachments ?? []} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
