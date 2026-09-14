import type { OptionDto } from '@liveconsole-ops/types';
import { Plus } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** Radix Select cannot hold an empty string, so "nothing chosen" has a sentinel. */
const NONE = '__none__';
/** The trailing "Add new" entry — picking it opens a form instead of choosing a value. */
const ADD_NEW = '__add_new__';

export interface OptionSelectProps {
  options: OptionDto[] | undefined;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  placeholder?: string;
  /** Adds a first entry that clears the value — "All sites", "No site". */
  emptyLabel?: string;
  /** Adds a last entry that creates a new record, e.g. opens "Add a site". */
  onAddNew?: () => void;
  addNewLabel?: string;
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
  onAddNew,
  addNewLabel = 'Add new',
  id,
  invalid,
  disabled,
  className,
  'aria-label': ariaLabel,
}: OptionSelectProps) => (
  <Select
    value={value ?? (emptyLabel ? NONE : undefined)}
    onValueChange={(next) => {
      if (next === ADD_NEW) {
        // Let the Select finish closing and returning focus before a dialog takes it.
        setTimeout(() => onAddNew?.(), 0);
        return;
      }
      onChange(next === NONE ? null : next);
    }}
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
      {onAddNew ? (
        <>
          {emptyLabel || options?.length ? <SelectSeparator /> : null}
          <SelectItem value={ADD_NEW} textValue={addNewLabel}>
            <span className="flex items-center gap-1.5 font-medium text-primary">
              <Plus className="size-3.5" />
              {addNewLabel}
            </span>
          </SelectItem>
        </>
      ) : null}
    </SelectContent>
  </Select>
);
