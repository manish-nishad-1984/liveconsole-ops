import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface DateRangeFilterProps {
  from: string | undefined;
  to: string | undefined;
  onChange: (range: { from: string | null; to: string | null }) => void;
  className?: string;
}

/** Two native date inputs — the phone's own date picker beats any custom one. */
export const DateRangeFilter = ({ from, to, onChange, className }: DateRangeFilterProps) => (
  <div className={cn('flex items-center gap-1.5', className)}>
    <Input
      type="date"
      value={from ?? ''}
      max={to || undefined}
      onChange={(event) => onChange({ from: event.target.value || null, to: to ?? null })}
      className="h-9 w-[9.5rem]"
      aria-label="From date"
    />
    <span className="text-xs text-muted-foreground">to</span>
    <Input
      type="date"
      value={to ?? ''}
      min={from || undefined}
      onChange={(event) => onChange({ from: from ?? null, to: event.target.value || null })}
      className="h-9 w-[9.5rem]"
      aria-label="To date"
    />
  </div>
);
