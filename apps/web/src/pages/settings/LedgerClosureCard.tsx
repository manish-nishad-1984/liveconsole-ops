import { formatCurrency, formatDateTime } from '@liveconsole-ops/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Scissors } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCan } from '@/hooks/use-permissions';
import { queryKeys } from '@/lib/query-client';
import { ledgerClosuresService } from '@/services/petty-cash.service';
import { formatDateOnly } from '@/utils/dates';
import { getErrorMessage } from '@/utils/errors';

/**
 * Closing the books, from the one screen an administrator already visits to
 * change the rules.
 *
 * The figures are shown before anything happens, because the only way to trust
 * this button is to see what it is about to do. Afterwards the closure stays
 * listed with an Undo beside it — the entries were archived, not deleted, so
 * putting them back is a real option rather than a promise.
 */

const LedgerClosureCard = () => {
  const queryClient = useQueryClient();
  const canView = useCan('ledger_closures:view');
  const canClose = useCan('ledger_closures:create');
  const canUndo = useCan('ledger_closures:delete');
  const [confirming, setConfirming] = useState(false);
  const [undoing, setUndoing] = useState<string | null>(null);

  const preview = useQuery({
    queryKey: queryKeys.ledgerClosures.preview,
    queryFn: () => ledgerClosuresService.preview(),
    enabled: canView,
  });

  const closures = useQuery({
    queryKey: queryKeys.ledgerClosures.all,
    queryFn: () => ledgerClosuresService.list(),
    enabled: canView,
  });

  /** Every figure moves, and the petty cash prefix covers balances and the dashboard. */
  const refreshEverything = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.ledgerClosures.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.ledgerClosures.preview });
    void queryClient.invalidateQueries({ queryKey: queryKeys.pettyCash.all });
  };

  const close = useMutation({
    mutationFn: () => ledgerClosuresService.create({}),
    onSuccess: (closure) => {
      refreshEverything();
      setConfirming(false);
      toast.success(
        `Books closed — ${closure.employeeCount} opening balance${
          closure.employeeCount === 1 ? '' : 's'
        } carried forward`,
      );
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not close the books.')),
  });

  const undo = useMutation({
    mutationFn: (id: string) => ledgerClosuresService.remove(id),
    onSuccess: () => {
      refreshEverything();
      setUndoing(null);
      toast.success('Closure undone — every entry is back');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not undo the closure.')),
  });

  if (!canView) return null;

  const standing = (closures.data ?? []).filter((closure) => !closure.reversedAt);
  const data = preview.data;
  const nothingToClose = data?.entryCount === 0;

  return (
    <Card className="max-w-xl">
      <CardContent className="space-y-4 pt-5">
        <div>
          <h3 className="text-sm font-semibold">Close the books</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Carries every employee&apos;s balance forward as an opening figure and clears the
            entries behind it, so a new period starts clean. Nothing is deleted — you can undo
            it.
          </p>
        </div>

        {preview.error ? (
          <ErrorState error={preview.error} onRetry={() => void preview.refetch()} />
        ) : data ? (
          <dl className="grid grid-cols-3 gap-3 rounded-md border border-border bg-muted/30 p-3 text-center">
            <div>
              <dt className="text-2xs uppercase tracking-wide text-muted-foreground">Entries</dt>
              <dd className="numeric text-sm font-semibold">{data.entryCount}</dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-wide text-muted-foreground">Employees</dt>
              <dd className="numeric text-sm font-semibold">{data.openings.length}</dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-wide text-muted-foreground">
                Carried forward
              </dt>
              <dd className="numeric text-sm font-semibold">
                {formatCurrency(data.openingTotal)}
              </dd>
            </div>
          </dl>
        ) : null}

        {canClose ? (
          <Button
            variant="outline"
            onClick={() => setConfirming(true)}
            disabled={preview.isLoading || nothingToClose}
          >
            <Scissors />
            Close the books now
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Only an administrator can do this.</p>
        )}

        {nothingToClose ? (
          <p className="text-xs text-muted-foreground">
            Nothing to close yet — no cash entries or expenses have been filed.
          </p>
        ) : null}

        {standing.length > 0 ? (
          <div className="space-y-2 border-t border-border pt-4">
            <h4 className="section-label">Closed periods</h4>
            {standing.map((closure) => (
              <div
                key={closure.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium">
                    {formatDateOnly(closure.closedOn)} ·{' '}
                    <span className="numeric">{formatCurrency(closure.openingTotal)}</span> carried
                  </p>
                  <p className="text-2xs text-muted-foreground">
                    {closure.entryCount} entries archived for {closure.employeeCount} employees ·{' '}
                    {formatDateTime(closure.createdAt)}
                  </p>
                </div>
                {canUndo ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setUndoing(closure.id)}
                  >
                    <RotateCcw />
                    Undo
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => !open && setConfirming(false)}
        title="Close the books?"
        variant="warning"
        confirmLabel="Close the books"
        loading={close.isPending}
        onConfirm={() => close.mutate()}
        description={
          data
            ? `${data.cashEntryCount} cash entries and ${data.expenseCount} expenses will stop appearing, and ${data.openings.length} opening balances totalling ${formatCurrency(data.openingTotal)} will be carried forward. You can undo this.`
            : undefined
        }
      >
        {/* The list is the point of the dialog: an administrator should recognise
            these names and figures before agreeing to anything. */}
        {data && data.openings.length > 0 ? (
          <div className="max-h-56 overflow-y-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <tbody>
                {data.openings.map((opening) => (
                  <tr key={opening.employee.id} className="border-b border-border/70 last:border-0">
                    <td className="px-3 py-1.5">{opening.employee.fullName}</td>
                    <td
                      className={`numeric px-3 py-1.5 text-right font-medium ${
                        Number(opening.amount) < 0 ? 'text-destructive' : ''
                      }`}
                    >
                      {formatCurrency(opening.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(undoing)}
        onOpenChange={(open) => !open && setUndoing(null)}
        title="Undo this closure?"
        variant="info"
        confirmLabel="Undo"
        loading={undo.isPending}
        onConfirm={() => { if (undoing) undo.mutate(undoing); }}
        description="Every archived entry comes back and the balances carried forward stop counting — the figures return to what they were before."
      />
    </Card>
  );
};

export default LedgerClosureCard;
