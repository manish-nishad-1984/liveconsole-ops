import { Copy } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';

export interface RevealedPassword {
  /** Mobile, email or name — whatever the user signs in with. */
  loginId: string;
  password: string;
}

/**
 * The one place a password is ever displayed. It is not stored in plaintext
 * anywhere and cannot be retrieved again, so the dialog says so plainly.
 */
export const TemporaryPasswordDialog = ({
  revealed,
  onClose,
}: {
  revealed: RevealedPassword | null;
  onClose: () => void;
}) => (
  <ConfirmDialog
    open={Boolean(revealed)}
    onOpenChange={(open) => !open && onClose()}
    variant="info"
    title="Temporary password"
    description={`Give this to ${revealed?.loginId ?? 'the user'}. It is shown once and cannot be retrieved again.`}
    confirmLabel="Done"
    cancelLabel="Close"
    onConfirm={onClose}
  >
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
      <code className="flex-1 truncate font-mono text-sm">{revealed?.password}</code>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Copy password"
        onClick={() => {
          if (!revealed) return;
          void navigator.clipboard.writeText(revealed.password);
          toast.success('Copied to clipboard');
        }}
      >
        <Copy />
      </Button>
    </div>
  </ConfirmDialog>
);
