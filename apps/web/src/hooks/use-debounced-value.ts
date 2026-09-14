import { useEffect, useState } from 'react';

/**
 * Delay a rapidly changing value. Used by SearchInput so typing does not fire a
 * request per keystroke, and by filter panels with free-text fields.
 */
export const useDebouncedValue = <T>(value: T, delayMs = 350): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};
