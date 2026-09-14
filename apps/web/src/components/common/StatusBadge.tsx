import { describeStatus, type StatusTone } from '@liveconsole-ops/shared';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface StatusBadgeProps {
  /** Any enum value from the system, e.g. `PENDING_APPROVAL`. */
  status: string | null | undefined;
  /** Override the derived tone for the rare context-dependent case. */
  tone?: StatusTone;
  /** Override the derived label. */
  label?: string;
  withDot?: boolean;
  className?: string;
}

const dotClasses: Record<StatusTone, string> = {
  neutral: 'bg-status-neutral',
  info: 'bg-status-info',
  progress: 'bg-status-progress',
  success: 'bg-status-success',
  warning: 'bg-status-warning',
  danger: 'bg-status-danger',
  muted: 'bg-muted-foreground',
};

/**
 * Renders any status enum consistently across every module.
 *
 * Label and colour both come from `@liveconsole-ops/shared`, so `APPROVED` looks
 * identical wherever it appears — and a new enum value gets sensible presentation
 * without touching this file.
 */
export const StatusBadge = ({
  status,
  tone,
  label,
  withDot = true,
  className,
}: StatusBadgeProps) => {
  const described = describeStatus(status);
  const resolvedTone = tone ?? described.tone;

  if (!status) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <Badge variant={resolvedTone} className={cn('gap-1.5', className)}>
      {withDot ? (
        <span
          className={cn('size-1.5 shrink-0 rounded-full', dotClasses[resolvedTone])}
          aria-hidden
        />
      ) : null}
      {label ?? described.label}
    </Badge>
  );
};
