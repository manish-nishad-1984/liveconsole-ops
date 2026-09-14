import { PASSWORD_RULES } from '@liveconsole-ops/shared';
import { Eye, EyeOff } from 'lucide-react';
import * as React from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Password field with a reveal toggle and, optionally, a strength meter.
 *
 * The toggle exists because the alternative is a "confirm password" field on
 * every screen that sets one; being able to read what you typed is what actually
 * stops the typo. It resets to hidden on blur so a revealed password is not left
 * on screen when the user walks away.
 */

export interface PasswordInputProps
  extends Omit<React.ComponentPropsWithoutRef<typeof Input>, 'type'> {
  /** Shows the requirement meter — use where a password is *set*, not entered. */
  showStrength?: boolean;
}

const METER_TONE = [
  'bg-status-danger',
  'bg-status-danger',
  'bg-status-warning',
  'bg-status-warning',
  'bg-status-success',
] as const;

/**
 * The rules come from `PASSWORD_RULES` in the shared package — the same list the
 * API validates against. A generic "weak/strong" score would be dishonest: the
 * server accepts or rejects on exactly these conditions, so those are what the
 * meter tracks.
 */
export const PasswordStrength = ({ value }: { value: string }) => {
  const met = PASSWORD_RULES.filter((rule) => rule.test(value));

  return (
    <div className="space-y-2 pt-1">
      <div className="flex gap-1" aria-hidden>
        {PASSWORD_RULES.map((rule, index) => (
          <span
            key={rule.label}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              index < met.length ? METER_TONE[met.length] : 'bg-border',
            )}
          />
        ))}
      </div>

      <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {PASSWORD_RULES.map((rule) => {
          const passed = rule.test(value);
          return (
            <li
              key={rule.label}
              className={cn(
                'flex items-center gap-1.5 text-2xs transition-colors',
                passed ? 'text-status-success' : 'text-muted-foreground',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  passed ? 'bg-status-success' : 'bg-border',
                )}
              />
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showStrength = false, onBlur, onChange, value, ...props }, ref) => {
    const [revealed, setRevealed] = React.useState(false);

    // Uncontrolled by default (react-hook-form registers it), so the meter reads
    // from a mirror of what was typed rather than requiring a controlled field.
    const [typed, setTyped] = React.useState('');
    const current = typeof value === 'string' ? value : typed;

    return (
      <div className="space-y-1">
        <div className="relative">
          <Input
            {...props}
            ref={ref}
            type={revealed ? 'text' : 'password'}
            className={cn('pr-9', className)}
            value={value}
            onChange={(event) => {
              if (showStrength) setTyped(event.target.value);
              onChange?.(event);
            }}
            onBlur={(event) => {
              setRevealed(false);
              onBlur?.(event);
            }}
          />

          <button
            type="button"
            // Off the tab path: it is a convenience, and stopping between the
            // password field and the submit button to skip a toggle is friction.
            tabIndex={-1}
            onClick={() => setRevealed((open) => !open)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            className="absolute right-0 top-0 flex size-9 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>

        {showStrength ? <PasswordStrength value={current} /> : null}
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';
