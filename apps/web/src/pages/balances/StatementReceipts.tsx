import type { AttachmentDto } from '@liveconsole-ops/types';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FileText, ImageOff, Loader2 } from 'lucide-react';

import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { formatFileSize } from '@/lib/image';
import { queryKeys } from '@/lib/query-client';
import { useReceiptUrl } from '@/pages/expenses/ReceiptGallery';
import { expensesService } from '@/services/petty-cash.service';

/**
 * The bills behind one statement line. Settling a statement is done line by
 * line, so the receipt opens over the statement rather than sending the reader
 * off to the expenses screen and back.
 *
 * The bill is shown full size straight away rather than as a thumbnail to click
 * again: the reader opened this to read the bill, and on a phone a thumbnail is
 * too small to read anything from.
 *
 * Read-only on purpose: nothing is removed from here, whatever the caller may
 * do on the expense itself.
 */

/** One bill, as large as the dialog allows. Images load as a blob — they are private. */
const Receipt = ({
  expenseId,
  attachment,
}: {
  expenseId: string;
  attachment: AttachmentDto;
}) => {
  const isImage = attachment.mimeType.startsWith('image/');
  const { url, isLoading, isError } = useReceiptUrl(expenseId, attachment);

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md border border-border bg-muted/40">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !url) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-md border border-border bg-muted/40">
        <ImageOff className="size-5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">This bill could not be loaded.</p>
      </div>
    );
  }

  // A PDF cannot be shown inline here, so it gets a button to open it instead.
  if (!isImage) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-border bg-muted/40 p-6">
        <FileText className="size-8 text-muted-foreground" />
        <p className="max-w-full truncate text-xs">{attachment.fileName}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => window.open(url, '_blank', 'noopener')}
        >
          <ExternalLink />
          Open
        </Button>
      </div>
    );
  }

  return (
    <figure className="space-y-1">
      {/* Opening the blob in a tab is how the reader zooms — the browser's own
          viewer does it better than anything rebuilt here. */}
      <button
        type="button"
        onClick={() => window.open(url, '_blank', 'noopener')}
        className="block w-full overflow-hidden rounded-md border border-border bg-muted/40"
        title="Open full size"
      >
        <img
          src={url}
          alt={attachment.fileName}
          className="max-h-[70vh] w-full object-contain"
        />
      </button>
      <figcaption className="flex items-center justify-between gap-2 text-2xs text-muted-foreground">
        <span className="truncate">{attachment.fileName}</span>
        <span className="numeric shrink-0">{formatFileSize(attachment.sizeBytes)}</span>
      </figcaption>
    </figure>
  );
};

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

  const attachments = query.data?.attachments ?? [];

  return (
    <Dialog open={Boolean(expenseId)} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="max-h-[90vh] overflow-y-auto">
        <DialogTitle className="text-sm">
          Receipts
          {documentNo ? <span className="numeric font-normal"> · {documentNo}</span> : null}
        </DialogTitle>

        {query.isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : attachments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No receipts attached.</p>
        ) : (
          <div className="space-y-4">
            {attachments.map((attachment) => (
              <Receipt
                key={attachment.id}
                expenseId={query.data!.id}
                attachment={attachment}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
