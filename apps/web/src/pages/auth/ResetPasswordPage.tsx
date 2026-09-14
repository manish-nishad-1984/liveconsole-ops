import { zodResolver } from '@hookform/resolvers/zod';
import { meetsPasswordPolicy } from '@liveconsole-ops/shared';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { FormAlert } from '@/components/common/FormAlert';
import { FormField } from '@/components/common/FormField';
import { PasswordInput } from '@/components/common/PasswordInput';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { ROUTES } from '@/routes/paths';
import { authService } from '@/services/auth.service';
import { applyFieldErrors } from '@/utils/errors';

/**
 * Set a new password from a reset link.
 *
 * The policy check comes from `meetsPasswordPolicy` in the shared package — the
 * same rules the API enforces — so the meter can never promise something the
 * server will then reject.
 */

const schema = z
  .object({
    password: z.string().refine(meetsPasswordPolicy, 'Password does not meet the requirements'),
    confirmPassword: z.string().min(1, 'Re-enter the password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The two passwords do not match',
  });

type ResetPasswordForm = z.infer<typeof schema>;

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [formError, setFormError] = useState<string | null>(null);

  useDocumentTitle('Set a new password');

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await authService.resetPassword({ token, password: values.password });
      navigate(ROUTES.login, { replace: true });
    } catch (error) {
      setFormError(
        applyFieldErrors(error, setError, {
          knownFields: ['password'],
          fallback: 'Could not reset your password.',
        }),
      );
    }
  });

  if (!token) {
    return (
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">Reset link not valid</h1>
        </div>
        <FormAlert tone="error">
          This link is missing its token. Request a new reset email and use the link from it.
        </FormAlert>
        <Link
          to={ROUTES.forgotPassword}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Set a new password</h1>
        <p className="text-sm text-muted-foreground">
          Choose something you have not used on this account before.
        </p>
      </div>

      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField label="New password" error={errors.password?.message} required>
          {(props) => (
            <PasswordInput
              {...props}
              {...register('password')}
              autoComplete="new-password"
              placeholder="••••••••"
              showStrength
              value={watch('password')}
              autoFocus
            />
          )}
        </FormField>

        <FormField label="Confirm password" error={errors.confirmPassword?.message} required>
          {(props) => (
            <PasswordInput
              {...props}
              {...register('confirmPassword')}
              autoComplete="new-password"
              placeholder="••••••••"
            />
          )}
        </FormField>

        <Button type="submit" className="w-full" loading={isSubmitting}>
          Set password
        </Button>
      </form>

      <p className="text-2xs leading-relaxed text-muted-foreground">
        Resetting your password signs you out of every other device.
      </p>
    </div>
  );
};

export default ResetPasswordPage;
