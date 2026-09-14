import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/utils';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Debounce window; 0 fires on every keystroke. */
  delayMs?: number;
  autoFocus?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * Debounced search box.
 *
 * The input keeps its own immediate state so typing stays responsive, and only
 * the debounced value is pushed upward. `value` is still honoured as the source
 * of truth, so clearing filters externally clears the box too.
 */
export const SearchInput = ({
  value,
  onChange,
  placeholder = 'Search…',
  delayMs = 350,
  autoFocus,
  className,
  'aria-label': ariaLabel,
}: SearchInputProps) => {
  const [draft, setDraft] = useState(value);
  const debounced = useDebouncedValue(draft, delayMs);
  const lastEmitted = useRef(value);

  // Emit upward when the debounced draft settles on something new.
  useEffect(() => {
    if (debounced !== lastEmitted.current) {
      lastEmitted.current = debounced;
      onChange(debounced);
    }
  }, [debounced, onChange]);

  // Accept external resets (Clear filters, navigating between saved views).
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setDraft(value);
    }
  }, [value]);

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={draft}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        onChange={(event) => setDraft(event.target.value)}
        className="h-9 pl-8 pr-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {draft ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setDraft('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
};
