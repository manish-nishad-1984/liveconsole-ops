import { zodResolver } from '@hookform/resolvers/zod';
import { parseLoginIdentifier } from '@liveconsole-ops/shared';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { FormAlert } from '@/components/common/FormAlert';
import { FormField } from '@/components/common/FormField';
import { PasswordInput } from '@/components/common/PasswordInput';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { ROUTES } from '@/routes/paths';
import { useAuthStore } from '@/store/auth.store';
import { applyFieldErrors } from '@/utils/errors';

/**
 * Sign in.
 *
 * Two things this screen deliberately does not do. It does not tell the user
 * which half of the pair was wrong — the server returns one message for an
 * unknown account and a wrong password, and inventing a friendlier "no account
 * found" here would leak which addresses and numbers are registered. And it does
 * not validate the identifier's *shape* beyond "you typed something": the field
 * accepts an email or a mobile number, and rejecting a plausible-looking entry
 * client-side would just be a second, worse copy of the server's rule.
 *
 * There is no sign-up link and no social buttons: accounts are provisioned by an
 * administrator, so a self-service path here would be a dead end.
 */

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email address or mobile number'),
  password: z.string().min(1, 'Enter your password'),
  rememberMe: z.boolean().default(false),
});

type LoginForm = z.infer<typeof loginSchema>;

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);

  const [formError, setFormError] = useState<string | null>(null);

  useDocumentTitle('Sign in');

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '', rememberMe: false },
  });

  const identifier = watch('identifier');
  const kind = identifier ? parseLoginIdentifier(identifier).kind : 'unknown';

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      const user = await login(values.identifier, values.password, values.rememberMe);

      // Return to whatever the user was trying to reach before the redirect.
      const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;

      navigate(user.mustChangePassword ? ROUTES.changePassword : (from ?? ROUTES.dashboard), {
        replace: true,
      });
    } catch (error) {
      setFormError(
        applyFieldErrors(error, setError, {
          knownFields: ['identifier', 'password'],
          fallback: 'Could not sign you in. Please try again.',
        }),
      );
    }
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Use your work email address or registered mobile number.
        </p>
      </div>

      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField
          label="Email or mobile"
          error={errors.identifier?.message}
          hint={
            kind === 'mobile'
              ? 'Signing in with your mobile number'
              : kind === 'email'
                ? 'Signing in with your email address'
                : undefined
          }
          required
        >
          {(props) => (
            <Input
              {...props}
              {...register('identifier')}
              // `username` rather than `email`: the field takes either, and telling
              // the password manager it is an email makes it skip mobile entries.
              autoComplete="username"
              inputMode="email"
              placeholder="you@company.com or 9825000001"
              autoFocus
            />
          )}
        </FormField>

        <FormField label="Password" error={errors.password?.message} required>
          {(props) => (
            <PasswordInput
              {...props}
              {...register('password')}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          )}
        </FormField>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id="rememberMe"
              checked={watch('rememberMe')}
              onCheckedChange={(checked) => setValue('rememberMe', checked === true)}
            />
            <Label htmlFor="rememberMe" className="cursor-pointer font-normal">
              Keep me signed in
            </Label>
          </div>

          <Link
            to={ROUTES.forgotPassword}
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="w-full" loading={isSubmitting}>
          Sign in
          {isSubmitting ? null : <ArrowRight />}
        </Button>
      </form>

      <p className="text-2xs leading-relaxed text-muted-foreground">
        Access is granted by your administrator. If you cannot sign in, ask them to check your
        account status and assigned role. Repeated failed attempts lock the account temporarily.
      </p>
    </div>
  );
};

export default LoginPage;
