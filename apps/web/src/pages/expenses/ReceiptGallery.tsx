import type { AttachmentDto } from '@liveconsole-ops/types';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FileText, ImageOff, Loader2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { formatFileSize } from '@/lib/image';
import { expensesService } from '@/services/petty-cash.service';

/**
 * Receipts are served only through the API (they are private), so an `<img src>`
 * cannot point at them directly. Each file is fetched as a blob with the session
 * token and shown through an object URL, which is released when it unmounts.
 */

const useReceiptUrl = (expenseId: string, attachment: AttachmentDto) => {
  const query = useQuery({
    queryKey: ['receipt', expenseId, attachment.id],
    queryFn: async () => (await expensesService.receiptBlob(expenseId, attachment.id)).blob,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  });

  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!query.data) return undefined;
    const objectUrl = URL.createObjectURL(query.data);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [query.data]);

  return { url, isLoading: query.isLoading, isError: query.isError };
};

const ReceiptThumb = ({
  expenseId,
  attachment,
  onOpen,
  onRemove,
}: {
  expenseId: string;
  attachment: AttachmentDto;
  onOpen: (url: string) => void;
  onRemove?: () => void;
}) => {
  const isImage = attachment.mimeType.startsWith('image/');
  const { url, isLoading, isError } = useReceiptUrl(expenseId, attachment);

  const open = () => {
    if (!url) return;
    if (isImage) onOpen(url);
    else window.open(url, '_blank', 'noopener');
  };

  return (
    <div className="group relative overflow-hidden rounded-md border border-border bg-muted/40">
      <button
        type="button"
        onClick={open}
        disabled={!url}
        className="flex aspect-square w-full items-center justify-center"
        aria-label={`Open ${attachment.fileName}`}
      >
        {isLoading ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : isError ? (
          <ImageOff className="size-5 text-muted-foreground" />
        ) : isImage && url ? (
          <img src={url} alt={attachment.fileName} className="size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 px-2 text-center">
            <FileText className="size-6 text-muted-foreground" />
            <span className="line-clamp-2 text-2xs">{attachment.fileName}</span>
          </span>
        )}
      </button>
      <div className="flex items-center justify-between gap-1 border-t border-border bg-card px-1.5 py-1">
        <span className="truncate text-2xs text-muted-foreground">
          {formatFileSize(attachment.sizeBytes)}
        </span>
        <div className="flex items-center">
          {!isImage && url ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-6"
              onClick={open}
              aria-label="Open"
            >
              <ExternalLink className="size-3.5" />
            </Button>
          ) : null}
          {onRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-6 text-destructive"
              onClick={onRemove}
              aria-label={`Remove ${attachment.fileName}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export interface ReceiptGalleryProps {
  expenseId: string;
  attachments: AttachmentDto[];
  onRemove?: (attachment: AttachmentDto) => void;
}

export const ReceiptGallery = ({ expenseId, attachments, onRemove }: ReceiptGalleryProps) => {
  const [preview, setPreview] = useState<string | null>(null);

  if (attachments.length === 0) {
    return <p className="text-xs text-muted-foreground">No receipts attached.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {attachments.map((attachment) => (
          <ReceiptThumb
            key={attachment.id}
            expenseId={expenseId}
            attachment={attachment}
            onOpen={setPreview}
            onRemove={onRemove ? () => onRemove(attachment) : undefined}
          />
        ))}
      </div>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent size="xl" className="p-2">
          <DialogTitle className="sr-only">Receipt</DialogTitle>
          {preview ? (
            <img
              src={preview}
              alt="Receipt"
              className="max-h-[80vh] w-full rounded object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};
