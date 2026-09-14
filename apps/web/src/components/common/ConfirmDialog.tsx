import { AlertTriangle, Info, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  /**
   * When set, the user must type this exact string to enable the confirm button.
   * Reserve it for genuinely destructive, unrecoverable actions.
   */
  requireTypedConfirmation?: string;
  children?: ReactNode;
}

const variantConfig = {
  danger: { icon: Trash2, iconClass: 'bg-destructive/10 text-destructive', button: 'destructive' },
  warning: {
    icon: AlertTriangle,
    iconClass: 'bg-status-warning/10 text-status-warning',
    button: 'default',
  },
  info: { icon: Info, iconClass: 'bg-accent text-accent-foreground', button: 'default' },
} as const;

/**
 * Confirmation for irreversible or wide-reaching actions.
 *
 * Deliberately *not* used for ordinary saves — a dialog on every action trains
 * users to dismiss dialogs without reading them, which is worse than no dialog.
 */
export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  requireTypedConfirmation,
  children,
}: ConfirmDialogProps) => {
  const [typed, setTyped] = useState('');
  const config = variantConfig[variant];
  const Icon = config.icon;

  const canConfirm = !requireTypedConfirmation || typed.trim() === requireTypedConfirmation;

  const handleOpenChange = (next: boolean) => {
    if (!next) setTyped('');
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-full',
                config.iconClass,
              )}
            >
              <Icon className="size-4" />
            </div>
            <div className="space-y-1">
              <DialogTitle>{title}</DialogTitle>
              {description ? <DialogDescription asChild><div>{description}</div></DialogDescription> : null}
            </div>
          </div>
        </DialogHeader>

        {children || requireTypedConfirmation ? (
          <DialogBody className="space-y-3">
            {children}
            {requireTypedConfirmation ? (
              <div className="space-y-1.5">
                <Label htmlFor="confirm-text">
                  Type{' '}
                  <span className="font-mono font-semibold">{requireTypedConfirmation}</span> to
                  confirm
                </Label>
                <Input
                  id="confirm-text"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  autoComplete="off"
                />
              </div>
            ) : null}
          </DialogBody>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={config.button}
            loading={loading}
            disabled={!canConfirm}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
