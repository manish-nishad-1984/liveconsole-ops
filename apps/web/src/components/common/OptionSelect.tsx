import type { OptionDto } from '@liveconsole-ops/types';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** Radix Select cannot hold an empty string, so "nothing chosen" has a sentinel. */
const NONE = '__none__';

export interface OptionSelectProps {
  options: OptionDto[] | undefined;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  placeholder?: string;
  /** Adds a first entry that clears the value — "All sites", "No site". */
  emptyLabel?: string;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** A Select over picker options, with the option's hint shown under its name. */
export const OptionSelect = ({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  emptyLabel,
  id,
  invalid,
  disabled,
  className,
  'aria-label': ariaLabel,
}: OptionSelectProps) => (
  <Select
    value={value ?? (emptyLabel ? NONE : undefined)}
    onValueChange={(next) => onChange(next === NONE ? null : next)}
    disabled={disabled}
  >
    <SelectTrigger id={id} invalid={invalid} className={cn(className)} aria-label={ariaLabel}>
      <SelectValue placeholder={options ? placeholder : 'Loading…'} />
    </SelectTrigger>
    <SelectContent>
      {emptyLabel ? <SelectItem value={NONE}>{emptyLabel}</SelectItem> : null}
      {(options ?? []).map((option) => (
        <SelectItem key={option.id} value={option.id} textValue={option.name}>
          <span className="block truncate">{option.name}</span>
          {option.hint ? (
            <span className="block truncate text-2xs text-muted-foreground">{option.hint}</span>
          ) : null}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);
