import { NAV_GROUPS } from '@liveconsole-ops/shared';
import type { PermissionCatalogGroup, PermissionKey } from '@liveconsole-ops/types';
import { Fragment, useMemo } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

/**
 * The permission matrix — one row per module, one checkbox per action.
 *
 * The catalog comes from the API, which reads it straight out of the TypeScript
 * `MODULE_PERMISSIONS` object rather than the database, so this grid always shows
 * exactly the permissions that exist in code. Nothing here has to be kept in sync
 * by hand: add a module to the catalog and a row appears.
 *
 * Rows are grouped the way the sidebar groups modules, so the matrix reads in the
 * order the person editing it already knows.
 */

export interface PermissionMatrixProps {
  catalog: PermissionCatalogGroup[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
}

/** Every action name that exists, in a stable order columns can rely on. */
const ACTION_ORDER = [
  'view',
  'create',
  'update',
  'delete',
  'approve',
  'assign',
  'export',
  'import',
  'manage',
];

interface MatrixSection {
  key: string;
  label: string;
  modules: PermissionCatalogGroup[];
}

export const PermissionMatrix = ({
  catalog,
  selected,
  onChange,
  disabled = false,
}: PermissionMatrixProps) => {
  const actions = useMemo(() => {
    const present = new Set(
      catalog.flatMap((group) => group.permissions.map((permission) => permission.action)),
    );
    return ACTION_ORDER.filter((action) => present.has(action));
  }, [catalog]);

  const allKeys = useMemo(
    () => catalog.flatMap((group) => group.permissions.map((permission) => permission.key)),
    [catalog],
  );

  const sections = useMemo<MatrixSection[]>(() => {
    const known = NAV_GROUPS.map((navGroup) => ({
      key: navGroup.key as string,
      label: navGroup.label,
      modules: catalog.filter((entry) => entry.group === navGroup.key),
    }));

    // A module whose group is not a nav group still has to appear somewhere —
    // silently dropping it would make a permission ungrantable through the UI.
    const orphans = catalog.filter(
      (entry) => !NAV_GROUPS.some((navGroup) => navGroup.key === entry.group),
    );

    return [...known, { key: 'other', label: 'Other', modules: orphans }].filter(
      (section) => section.modules.length > 0,
    );
  }, [catalog]);

  const setKeys = (keys: PermissionKey[], checked: boolean) => {
    const next = new Set(selected);
    for (const key of keys) {
      if (checked) next.add(key);
      else next.delete(key);
    }
    onChange(next);
  };

  const allChecked = allKeys.length > 0 && allKeys.every((key) => selected.has(key));
  const someChecked = allKeys.some((key) => selected.has(key));

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="whitespace-nowrap border-b border-border bg-muted/70 px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="flex items-center gap-2">
                <Checkbox
                  aria-label="Select every permission"
                  disabled={disabled}
                  checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                  onCheckedChange={(checked) => setKeys(allKeys, checked === true)}
                />
                Module
              </span>
            </th>
            {actions.map((action) => (
              <th
                key={action}
                className="whitespace-nowrap border-b border-border bg-muted/70 px-3 py-2 text-center text-2xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {action}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {sections.map((section) => (
            <Fragment key={section.key}>
              <tr>
                <td
                  colSpan={actions.length + 1}
                  className="border-b border-border bg-muted/30 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {section.label}
                </td>
              </tr>

              {section.modules.map((entry) => {
                const moduleKeys = entry.permissions.map((permission) => permission.key);
                const moduleAll = moduleKeys.every((key) => selected.has(key));
                const moduleSome = moduleKeys.some((key) => selected.has(key));

                return (
                  <tr key={entry.module} className="hover:bg-accent/30">
                    <td className="whitespace-nowrap border-b border-border/70 px-3 py-2">
                      <span className="flex items-center gap-2">
                        <Checkbox
                          aria-label={`Select every permission on ${entry.label}`}
                          disabled={disabled}
                          checked={moduleAll ? true : moduleSome ? 'indeterminate' : false}
                          onCheckedChange={(checked) => setKeys(moduleKeys, checked === true)}
                        />
                        <span className="text-xs font-medium">{entry.label}</span>
                      </span>
                    </td>

                    {actions.map((action) => {
                      const permission = entry.permissions.find(
                        (candidate) => candidate.action === action,
                      );

                      return (
                        <td
                          key={action}
                          className={cn(
                            'border-b border-border/70 px-3 py-2 text-center',
                            !permission && 'bg-muted/20',
                          )}
                        >
                          {permission ? (
                            <Checkbox
                              aria-label={`${entry.label}: ${action}`}
                              disabled={disabled}
                              checked={selected.has(permission.key)}
                              onCheckedChange={(checked) =>
                                setKeys([permission.key], checked === true)
                              }
                            />
                          ) : (
                            // The module has no such action — an empty cell is the
                            // honest rendering, not a permanently disabled box.
                            <span className="text-2xs text-muted-foreground/40">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};
