import type { ReactNode } from 'react';
import { useId } from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface FormFieldProps {
  label: string;
  /** Message from react-hook-form's `formState.errors`. */
  error?: string;
  hint?: string;
  required?: boolean;
  /** Span both columns of a FormGrid — for long text and item tables. */
  full?: boolean;
  className?: string;
  /**
   * Receives the generated ids so the control can wire up `id`,
   * `aria-describedby` and `aria-invalid` correctly.
   */
  children: (props: {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': boolean | undefined;
    invalid: boolean;
  }) => ReactNode;
}

/**
 * Label, control, hint and error for one form field.
 *
 * The accessibility wiring lives here rather than in every form: a field with an
 * error must announce it, and doing that by hand thirty times per module
 * guarantees some of them are missed.
 */
export const FormField = ({
  label,
  error,
  hint,
  required,
  full,
  className,
  children,
}: FormFieldProps) => {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = [error ? errorId : null, hint && !error ? hintId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cn('space-y-1.5', full && 'sm:col-span-2 lg:col-span-3', className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>

      {children({
        id,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': error ? true : undefined,
        invalid: Boolean(error),
      })}

      {error ? (
        <p id={errorId} role="alert" className="text-2xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-2xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
};
