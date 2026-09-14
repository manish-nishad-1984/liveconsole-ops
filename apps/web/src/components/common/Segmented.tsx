import { cn } from '@/lib/utils';

export interface SegmentedProps<T extends string> {
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  labels: Record<T, string>;
  className?: string;
}

/** A two-or-three way toggle — one tap on a phone, where a dropdown takes three. */
export const Segmented = <T extends string>({
  value,
  options,
  onChange,
  labels,
  className,
}: SegmentedProps<T>) => (
  <div
    role="radiogroup"
    className={cn('grid auto-cols-fr grid-flow-col gap-1 rounded-md bg-muted p-1', className)}
  >
    {options.map((option) => (
      <button
        key={option}
        type="button"
        role="radio"
        aria-checked={value === option}
        onClick={() => onChange(option)}
        className={cn(
          'rounded px-3 py-1.5 text-xs font-medium transition-colors',
          value === option
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {labels[option]}
      </button>
    ))}
  </div>
);
