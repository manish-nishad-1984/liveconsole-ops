import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * The `status` variants map one-to-one onto `StatusTone` from
 * `@liveconsole-ops/shared`, so StatusBadge can pass a tone straight through
 * without a lookup table of its own.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium transition-colors whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        neutral: 'border-status-neutral/25 bg-status-neutral/10 text-status-neutral',
        info: 'border-status-info/25 bg-status-info/10 text-status-info',
        progress: 'border-status-progress/25 bg-status-progress/10 text-status-progress',
        success: 'border-status-success/25 bg-status-success/10 text-status-success',
        warning: 'border-status-warning/30 bg-status-warning/10 text-status-warning',
        danger: 'border-status-danger/25 bg-status-danger/10 text-status-danger',
        muted: 'border-border bg-muted text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'secondary' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);

export { badgeVariants };
