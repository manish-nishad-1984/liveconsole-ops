import type { FormEvent, ReactNode } from 'react';

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
import { cn } from '@/lib/utils';

export interface FormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Wire to react-hook-form's `handleSubmit(...)`. */
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Extra controls on the left of the footer, e.g. "Save & add another". */
  footerStart?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * The wrapper for every create/edit form in the app.
 *
 * A real `<form>` element hosts the fields, so Enter submits and the browser's own
 * validation and autofill behave normally — a `<div>` with an onClick handler gets
 * none of that. Closing while submitting is blocked so a half-finished mutation
 * cannot be orphaned by an accidental Escape.
 */
export const FormModal = ({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  isSubmitting = false,
  submitDisabled = false,
  size = 'lg',
  footerStart,
  children,
  className,
}: FormModalProps) => (
  <Dialog
    open={open}
    onOpenChange={(next) => {
      if (isSubmitting) return;
      onOpenChange(next);
    }}
  >
    <DialogContent
      size={size}
      className={className}
      onInteractOutside={(event) => {
        // Clicking away from a partially filled form should not discard it.
        if (isSubmitting) event.preventDefault();
      }}
    >
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <DialogBody className="space-y-4">{children}</DialogBody>

        <DialogFooter className="sm:justify-between">
          <div className="flex items-center gap-2">{footerStart}</div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {cancelLabel}
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={submitDisabled}>
              {submitLabel}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
);

/** Two-column field grid — the default layout inside a FormModal. */
export const FormGrid = ({
  columns = 2,
  className,
  children,
}: {
  columns?: 1 | 2 | 3;
  className?: string;
  children: ReactNode;
}) => (
  <div
    className={cn(
      'grid gap-4',
      columns === 1 && 'grid-cols-1',
      columns === 2 && 'sm:grid-cols-2',
      columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
      className,
    )}
  >
    {children}
  </div>
);

/** Labelled group inside a long form, e.g. "Access". */
export const FormSection = ({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) => (
  <section className={cn('space-y-3', className)}>
    <div className="space-y-0.5">
      <h4 className="section-label">{title}</h4>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
    {children}
  </section>
);
