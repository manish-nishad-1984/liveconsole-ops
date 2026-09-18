import type { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  /**
   * Tints the whole tile, so figures read by colour on every screen: received
   * green, returned amber, spent red, balance blue, vehicles out purple (the
   * On rent badge's hue). The icon takes the same hue unless `tone` asks for
   * another (a negative balance stays red).
   */
  surface?: Surface;
  /** Makes the whole tile a button — e.g. "filter to pending". */
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

type Surface = 'success' | 'warning' | 'danger' | 'info' | 'progress';

const surfaceClasses: Record<Surface, { card: string; icon: string }> = {
  success: {
    card: 'border-status-success/30 bg-status-success/10',
    icon: 'bg-status-success/15 text-status-success',
  },
  warning: {
    card: 'border-status-warning/30 bg-status-warning/10',
    icon: 'bg-status-warning/15 text-status-warning',
  },
  danger: {
    card: 'border-status-danger/30 bg-status-danger/10',
    icon: 'bg-status-danger/15 text-status-danger',
  },
  info: {
    card: 'border-status-info/30 bg-status-info/10',
    icon: 'bg-status-info/15 text-status-info',
  },
  progress: {
    card: 'border-status-progress/30 bg-status-progress/10',
    icon: 'bg-status-progress/15 text-status-progress',
  },
};

const toneClasses = {
  default: 'bg-accent text-accent-foreground',
  success: 'bg-status-success/10 text-status-success',
  warning: 'bg-status-warning/10 text-status-warning',
  danger: 'bg-status-danger/10 text-status-danger',
} as const;

/** A headline number with its label — dashboard and list summaries. */
export const StatTile = ({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
  surface,
  onClick,
  active,
  className,
}: StatTileProps) => {
  const body = (
    <CardContent className="flex items-start gap-3">
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-md',
          surface && tone === 'default' ? surfaceClasses[surface].icon : toneClasses[tone],
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 space-y-0.5 text-left">
        <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="numeric truncate text-lg font-semibold leading-tight sm:text-xl">{value}</p>
        {hint ? <p className="truncate text-2xs text-muted-foreground">{hint}</p> : null}
      </div>
    </CardContent>
  );

  return (
    <Card
      className={cn(
        surface && surfaceClasses[surface].card,
        onClick && 'transition-colors hover:border-primary/40',
        active && 'border-primary ring-1 ring-primary/30',
        className,
      )}
    >
      {onClick ? (
        <button type="button" onClick={onClick} className="block w-full" aria-pressed={active}>
          {body}
        </button>
      ) : (
        body
      )}
    </Card>
  );
};
