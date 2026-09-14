import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * The message at the top of a form — what went wrong with the submission as a
 * whole, as opposed to with one field.
 *
 * `role="alert"` is the point of extracting it: a failure the user cannot see
 * because they are focused on a field at the bottom of a long form is a failure
 * that reads as the button not working.
 */

export type FormAlertTone = 'error' | 'warning' | 'success' | 'info';

const TONE: Record<FormAlertTone, { icon: LucideIcon; className: string; iconClass: string }> = {
  error: {
    icon: AlertCircle,
    className: 'border-destructive/30 bg-destructive/5 text-destructive',
    iconClass: 'text-destructive',
  },
  warning: {
    icon: TriangleAlert,
    className: 'border-status-warning/30 bg-status-warning/5 text-status-warning',
    iconClass: 'text-status-warning',
  },
  success: {
    icon: CheckCircle2,
    className: 'border-status-success/30 bg-status-success/5 text-status-success',
    iconClass: 'text-status-success',
  },
  info: {
    icon: Info,
    className: 'border-border bg-muted/40 text-foreground',
    iconClass: 'text-muted-foreground',
  },
};

export interface FormAlertProps {
  tone?: FormAlertTone;
  title?: string;
  children: ReactNode;
  className?: string;
}

export const FormAlert = ({ tone = 'error', title, children, className }: FormAlertProps) => {
  const { icon: Icon, className: toneClass, iconClass } = TONE[tone];

  return (
    <div
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2.5 rounded-md border px-3 py-2.5', toneClass, className)}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', iconClass)} aria-hidden />
      <div className="min-w-0 space-y-0.5">
        {title ? <p className="text-xs font-semibold">{title}</p> : null}
        <div className="text-xs leading-relaxed">{children}</div>
      </div>
    </div>
  );
};
