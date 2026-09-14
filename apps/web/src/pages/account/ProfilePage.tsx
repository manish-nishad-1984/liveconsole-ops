import { zodResolver } from '@hookform/resolvers/zod';
import { formatDateTime } from '@liveconsole-ops/shared';
import { useQuery } from '@tanstack/react-query';
import { LogOut, MonitorSmartphone } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { FormAlert } from '@/components/common/FormAlert';
import { FormField } from '@/components/common/FormField';
import { LoadingState } from '@/components/common/LoadingState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/ui/avatar';
import { DetailLayout, SectionCard } from '@/layouts/PageLayout';
import { queryKeys } from '@/lib/query-client';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';
import { applyFieldErrors } from '@/utils/errors';

/**
 * Your own account.
 *
 * The editable fields are exactly the ones the API's `updateProfileSchema`
 * accepts: name, mobile, avatar. Role, status and organisation are shown but not
 * editable, because letting somebody change those on their own record would be a
 * privilege-escalation path dressed up as a settings page.
 */

const schema = z.object({
  fullName: z.string().trim().min(1, 'Enter your name').max(120),
  phone: z.string().trim().max(20),
});

type ProfileForm = z.infer<typeof schema>;

const ProfilePage = () => {
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const logoutEverywhere = useAuthStore((state) => state.logoutEverywhere);

  const [formError, setFormError] = useState<string | null>(null);

  const sessions = useQuery({
    queryKey: queryKeys.auth.sessions,
    queryFn: () => authService.sessions(),
  });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(schema),
    values: { fullName: user?.fullName ?? '', phone: user?.phone ?? '' },
  });

  if (!user) return <LoadingState variant="page" />;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await updateProfile({ fullName: values.fullName, phone: values.phone || null });
      toast.success('Profile updated');
    } catch (error) {
      setFormError(
        applyFieldErrors(error, setError, {
          knownFields: ['fullName', 'phone'],
          fallback: 'Could not save your profile.',
        }),
      );
    }
  });

  return (
    <DetailLayout
      title="My profile"
      description="Your own account details."
      aside={
        <>
          <SectionCard title="Access" description="Set by an administrator.">
            <dl className="space-y-3 text-xs">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Organisation</dt>
                <dd className="text-right font-medium">{user.organization?.name ?? '—'}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="text-right font-medium">{user.status}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Roles</dt>
                <dd className="flex flex-wrap justify-end gap-1">
                  {user.isSuperAdmin ? <Badge variant="default">Super admin</Badge> : null}
                  {user.roles.map((role) => (
                    <Badge key={role.id} variant="outline">
                      {role.name}
                    </Badge>
                  ))}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Permissions</dt>
                <dd className="numeric text-right">{user.permissions.length}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Last sign-in</dt>
                <dd className="text-right">{formatDateTime(user.lastLoginAt)}</dd>
              </div>
            </dl>
          </SectionCard>

          <SectionCard
            title="Active sessions"
            description="Devices currently holding a valid session."
            actions={
              <Button variant="outline" size="sm" onClick={() => void logoutEverywhere()}>
                <LogOut />
                Sign out everywhere
              </Button>
            }
          >
            {sessions.isLoading ? (
              <LoadingState variant="inline" />
            ) : sessions.data?.length ? (
              <ul className="space-y-3">
                {sessions.data.map((session) => (
                  <li key={session.id} className="flex items-start gap-2.5 text-xs">
                    <MonitorSmartphone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate font-medium">
                        {session.userAgent ?? 'Unknown device'}
                        {session.isCurrent ? (
                          <Badge variant="success" className="ml-2">
                            This device
                          </Badge>
                        ) : null}
                      </p>
                      <p className="text-muted-foreground">
                        {session.ipAddress ?? 'no IP recorded'} · started{' '}
                        {formatDateTime(session.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No other active sessions.</p>
            )}
          </SectionCard>
        </>
      }
    >
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <UserAvatar name={user.fullName} src={user.avatarUrl} className="size-12" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email ?? user.phone}</p>
            </div>
          </div>

          {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormField label="Full name" error={errors.fullName?.message} required>
              {(props) => <Input {...props} {...register('fullName')} autoComplete="name" />}
            </FormField>

            <FormField
              label="Mobile"
              error={errors.phone?.message}
              hint="Used as an alternative sign-in identifier."
            >
              {(props) => (
                <Input {...props} {...register('phone')} inputMode="tel" autoComplete="tel" />
              )}
            </FormField>

            <FormField label="Email">
              {(props) => <Input {...props} value={user.email ?? 'Not set'} disabled />}
            </FormField>

            <div className="flex justify-end pt-2">
              <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </DetailLayout>
  );
};

export default ProfilePage;
