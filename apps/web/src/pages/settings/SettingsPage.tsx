import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { ErrorState } from '@/components/common/ErrorState';
import { FormAlert } from '@/components/common/FormAlert';
import { FormField } from '@/components/common/FormField';
import { LoadingState } from '@/components/common/LoadingState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useCan } from '@/hooks/use-permissions';
import { PageLayout } from '@/layouts/PageLayout';
import { queryKeys } from '@/lib/query-client';
import { settingsService } from '@/services/masters.service';
import { applyFieldErrors } from '@/utils/errors';

/**
 * Settings — the rules the office can change without a release.
 *
 * One setting so far, so the screen is a single card rather than a tabbed shell:
 * how far back site staff may date an expense. Administrators are not bound by
 * it, which is the point — they are who an employee goes to when it bites.
 */

const schema = z.object({
  expenseBackdateDays: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, 'Enter a whole number of days'),
});

type SettingsForm = z.infer<typeof schema>;

/** "2" → "today, yesterday and the day before" — the rule in plain words. */
const describeWindow = (days: number): string => {
  if (!Number.isFinite(days) || days < 0) return '—';
  if (days === 0) return 'today only';
  if (days === 1) return 'today and yesterday';
  return `today and the previous ${days} days`;
};

const SettingsPage = () => {
  const queryClient = useQueryClient();
  const canUpdate = useCan('company_settings:update');
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: () => settingsService.get(),
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isDirty },
  } = useForm<SettingsForm>({
    resolver: zodResolver(schema),
    defaultValues: { expenseBackdateDays: '' },
  });

  useEffect(() => {
    if (query.data) reset({ expenseBackdateDays: String(query.data.expenseBackdateDays) });
  }, [query.data, reset]);

  const mutation = useMutation({
    mutationFn: (values: SettingsForm) =>
      settingsService.update({ expenseBackdateDays: Number(values.expenseBackdateDays) }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.pettyCash.all });
      reset({ expenseBackdateDays: String(saved.expenseBackdateDays) });
      setFormError(null);
      toast.success('Settings saved');
    },
    onError: (error) =>
      setFormError(
        applyFieldErrors(error, setError, {
          knownFields: ['expenseBackdateDays'],
          fallback: 'Could not save the settings.',
        }),
      ),
  });

  const preview = describeWindow(Number(watch('expenseBackdateDays')));

  return (
    <PageLayout title="Settings" description="Rules the office can change without a release.">
      {query.isLoading ? (
        <LoadingState variant="cards" />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <Card className="max-w-xl">
          <CardContent className="space-y-4 pt-5">
            <div>
              <h3 className="text-sm font-semibold">Backdating expenses</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                How many days back an employee may date an expense. Administrators are not
                limited — they can file and edit any date, including on an employee&apos;s behalf.
              </p>
            </div>

            {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

            <form
              className="space-y-4"
              onSubmit={handleSubmit((values) => mutation.mutate(values))}
            >
              <FormField
                label="Days back"
                error={errors.expenseBackdateDays?.message}
                hint={`Employees can file for ${preview}. 0 means today only.`}
              >
                {(props) => (
                  <Input
                    {...props}
                    {...register('expenseBackdateDays')}
                    inputMode="numeric"
                    className="w-28"
                    max={query.data?.maxExpenseBackdateDays}
                    disabled={!canUpdate}
                  />
                )}
              </FormField>

              {canUpdate ? (
                <Button type="submit" loading={mutation.isPending} disabled={!isDirty}>
                  Save changes
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Only an administrator can change this.
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      )}
    </PageLayout>
  );
};

export default SettingsPage;
