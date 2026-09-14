import type { OptionDto, PermissionKey } from '@liveconsole-ops/types';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useState } from 'react';

import { usePermissions } from '@/hooks/use-permissions';
import { queryKeys } from '@/lib/query-client';
import { CategoryFormModal } from '@/pages/expense-categories/CategoryFormModal';
import { SiteFormModal } from '@/pages/sites/SiteFormModal';
import {
  TemporaryPasswordDialog,
  type RevealedPassword,
} from '@/pages/users/TemporaryPasswordDialog';
import { UserFormModal } from '@/pages/users/UserFormModal';

/**
 * "Add new" from inside a picker: the record is created in its usual form, laid
 * over the form the user was filling, and the picker then selects it — no
 * leaving a half-filled expense to go and create a site first.
 */

export type QuickAddKind = 'site' | 'category' | 'employee';

const PERMISSION: Record<QuickAddKind, PermissionKey> = {
  site: 'sites:create',
  category: 'expense_categories:create',
  employee: 'users:create',
};

/** State for one form's quick-add dialogs; `addNew(kind)` is undefined without the permission. */
export const useQuickAdd = () => {
  const { can } = usePermissions();
  const [adding, setAdding] = useState<QuickAddKind | null>(null);

  const addNew = (kind: QuickAddKind) =>
    can(PERMISSION[kind]) ? () => setAdding(kind) : undefined;

  return { adding, addNew, close: () => setAdding(null) };
};

export interface QuickAddDialogsProps {
  adding: QuickAddKind | null;
  onClose: () => void;
  /** The id of the record just created, to select it in the picker. */
  onAdded: (kind: QuickAddKind, id: string) => void;
}

/**
 * Render as a sibling of the host form, never inside it: a dialog rendered within
 * a `<form>` would bubble its own submit to the host through the React tree.
 */
export const QuickAddDialogs = ({ adding, onClose, onAdded }: QuickAddDialogsProps) => {
  const queryClient = useQueryClient();
  const [revealed, setRevealed] = useState<RevealedPassword | null>(null);

  // Put the new option into the picker straight away, so the Select can show its
  // name before the options refetch comes back.
  const added = (kind: QuickAddKind, key: QueryKey, option: OptionDto) => {
    queryClient.setQueryData<OptionDto[]>(key, (current) =>
      current ? [...current.filter((item) => item.id !== option.id), option] : current,
    );
    onAdded(kind, option.id);
  };

  const onOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <>
      <SiteFormModal
        open={adding === 'site'}
        onOpenChange={onOpenChange}
        site={null}
        onSaved={(site) =>
          added('site', queryKeys.sites.options, {
            id: site.id,
            name: site.name,
            hint: site.location,
          })
        }
      />
      <CategoryFormModal
        open={adding === 'category'}
        onOpenChange={onOpenChange}
        category={null}
        onSaved={(category) =>
          added('category', queryKeys.expenseCategories.options, {
            id: category.id,
            name: category.name,
            hint: category.description,
          })
        }
      />
      <UserFormModal
        open={adding === 'employee'}
        onOpenChange={onOpenChange}
        user={null}
        onSaved={(user) =>
          added('employee', queryKeys.employees.options, {
            id: user.id,
            name: user.fullName,
            hint: [user.designation, user.phone].filter(Boolean).join(' · ') || null,
          })
        }
        onCreatedWithTemporaryPassword={(loginId, password) => setRevealed({ loginId, password })}
      />
      <TemporaryPasswordDialog revealed={revealed} onClose={() => setRevealed(null)} />
    </>
  );
};
