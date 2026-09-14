import { zodResolver } from '@hookform/resolvers/zod';
import { meetsPasswordPolicy } from '@liveconsole-ops/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { FormAlert } from '@/components/common/FormAlert';
import { FormField } from '@/components/common/FormField';
import { PasswordInput } from '@/components/common/PasswordInput';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageLayout } from '@/layouts/PageLayout';
import { ROUTES } from '@/routes/paths';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';
import { applyFieldErrors } from '@/utils/errors';

/**
 * Change your own password.
 *
 * Succeeding here signs every device out, including this one — the API bumps
 * `tokenVersion` and revokes the refresh tokens — so the screen sends the user
 * back to sign-in rather than pretending the session survived.
 */

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().refine(meetsPasswordPolicy, 'Password does not meet the requirements'),
    confirmPassword: z.string().min(1, 'Re-enter the new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The two passwords do not match',
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    path: ['newPassword'],
    message: 'The new password must be different from the current one',
  });

type ChangePasswordForm = z.infer<typeof schema>;

const ChangePasswordPage = () => {
  const navigate = useNavigate();
  const mustChangePassword = useAuthStore((state) => state.user?.mustChangePassword ?? false);
  const logout = useAuthStore((state) => state.logout);

  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await authService.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      // The session is already dead server-side; clear it locally and go to login.
      await logout();
      navigate(ROUTES.login, { replace: true });
    } catch (error) {
      setFormError(
        applyFieldErrors(error, setError, {
          knownFields: ['currentPassword', 'newPassword'],
          fallback: 'Could not change your password.',
        }),
      );
    }
  });

  return (
    <PageLayout
      title="Change password"
      description="Changing your password signs you out of every device."
    >
      <Card className="max-w-xl">
        <CardContent className="space-y-4">
          {mustChangePassword ? (
            <FormAlert tone="warning" title="A new password is required">
              Your account is using a temporary password set by an administrator. Choose your own
              before continuing.
            </FormAlert>
          ) : null}

          {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormField label="Current password" error={errors.currentPassword?.message} required>
              {(props) => (
                <PasswordInput
                  {...props}
                  {...register('currentPassword')}
                  autoComplete="current-password"
                />
              )}
            </FormField>

            <FormField label="New password" error={errors.newPassword?.message} required>
              {(props) => (
                <PasswordInput
                  {...props}
                  {...register('newPassword')}
                  autoComplete="new-password"
                  showStrength
                  value={watch('newPassword')}
                />
              )}
            </FormField>

            <FormField label="Confirm new password" error={errors.confirmPassword?.message} required>
              {(props) => (
                <PasswordInput
                  {...props}
                  {...register('confirmPassword')}
                  autoComplete="new-password"
                />
              )}
            </FormField>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="submit" loading={isSubmitting}>
                Change password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageLayout>
  );
};

export default ChangePasswordPage;
