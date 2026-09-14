import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { FormAlert } from '@/components/common/FormAlert';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { ROUTES } from '@/routes/paths';
import { authService } from '@/services/auth.service';
import { getErrorMessage } from '@/utils/errors';

/**
 * Request a reset link.
 *
 * The confirmation is identical whether or not the address is registered — the
 * server returns the same body either way, and showing "no such account" here
 * would turn this form into an account-enumeration oracle.
 *
 * In development the API also returns the raw token so a reset can be exercised
 * without a mail server; that is shown here for exactly that reason.
 */

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address'),
});

type ForgotPasswordForm = z.infer<typeof schema>;

const ForgotPasswordPage = () => {
  const [sent, setSent] = useState<{ message: string; devToken?: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useDocumentTitle('Forgot password');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      setSent(await authService.forgotPassword(values.email));
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          Enter the email address on your account and we will send a reset link.
        </p>
      </div>

      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

      {sent ? (
        <FormAlert tone="success" title="Check your inbox">
          {sent.message}
          {sent.devToken ? (
            <>
              {' '}
              <span className="block pt-2">
                Development only — use this token directly:{' '}
                <Link
                  to={`${ROUTES.resetPassword}?token=${sent.devToken}`}
                  className="font-mono underline underline-offset-4"
                >
                  open the reset form
                </Link>
              </span>
            </>
          ) : null}
        </FormAlert>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField label="Email address" error={errors.email?.message} required>
            {(props) => (
              <Input
                {...props}
                {...register('email')}
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                autoFocus
              />
            )}
          </FormField>

          <Button type="submit" className="w-full" loading={isSubmitting}>
            Send reset link
          </Button>
        </form>
      )}

      <Link
        to={ROUTES.login}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline"
      >
        <ArrowLeft className="size-3.5" />
        Back to sign in
      </Link>
    </div>
  );
};

export default ForgotPasswordPage;
