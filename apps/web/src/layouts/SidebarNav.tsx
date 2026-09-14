import { buildNavTree, type ModuleDefinition, type NavGroup, type NavNode } from '@liveconsole-ops/shared';
import { ChevronRight } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Hint } from '@/components/ui/tooltip';
import { usePermissions } from '@/hooks/use-permissions';
import { resolveIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store/ui.store';

/**
 * The navigation tree.
 *
 * Structure comes from the shared module registry and visibility from the
 * signed-in user's permissions, so this file decides presentation only — which is
 * why adding a module never touches it.
 *
 * Two presentations of the same tree:
 *  • expanded rail: groups are accordions, remembered across sessions
 *  • collapsed rail: groups become flyouts, because an icon alone cannot carry
 *    a list of children
 */

const isModuleActive = (pathname: string, module: ModuleDefinition): boolean =>
  pathname === module.path || pathname.startsWith(`${module.path}/`);

/* ------------------------------------------------------------------ */

const NavItem = ({
  module,
  depth = 0,
  onNavigate,
}: {
  module: ModuleDefinition;
  /** 1 when nested under a group, which indents and drops the icon. */
  depth?: 0 | 1;
  onNavigate?: () => void;
}) => {
  const Icon = resolveIcon(module.icon);

  return (
    <NavLink
      to={module.path}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-2.5 rounded-md py-1.5 pr-2 text-sm transition-colors',
          depth === 0 ? 'px-2.5 font-medium' : 'pl-8',
          'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          isActive && 'bg-accent font-medium text-accent-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Rail marker: the cue that survives at a glance down a long list. */}
          <span
            aria-hidden
            className={cn(
              'absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-primary transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
          />
          {depth === 0 ? (
            <Icon
              className={cn('size-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')}
              strokeWidth={2}
            />
          ) : (
            <span
              aria-hidden
              className={cn(
                'absolute left-[1.05rem] size-1.5 rounded-full transition-colors',
                isActive ? 'bg-primary' : 'bg-border group-hover:bg-muted-foreground/50',
              )}
            />
          )}
          <span className="truncate">{module.label}</span>
        </>
      )}
    </NavLink>
  );
};

/* ------------------------------------------------------------------ */

const NavGroupSection = ({
  group,
  modules,
  onNavigate,
}: {
  group: NavGroup;
  modules: ModuleDefinition[];
  onNavigate?: () => void;
}) => {
  const { pathname } = useLocation();
  const expandedGroups = useUiStore((state) => state.expandedNavGroups);
  const toggleNavGroup = useUiStore((state) => state.toggleNavGroup);
  const expandNavGroup = useUiStore((state) => state.expandNavGroup);

  const containsActive = modules.some((module) => isModuleActive(pathname, module));
  const isOpen = expandedGroups.includes(group.key);

  // Landing on a route inside a closed group must reveal it — otherwise the
  // sidebar shows nothing selected and the user cannot tell where they are.
  useEffect(() => {
    if (containsActive && !isOpen) expandNavGroup(group.key);
    // Deliberately keyed on the route only: reacting to `isOpen` as well would
    // re-open the group the moment the user collapsed it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containsActive]);

  const contentId = `nav-group-${group.key}`;

  return (
    <div>
      <button
        type="button"
        onClick={() => toggleNavGroup(group.key)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
          'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          containsActive && !isOpen && 'text-foreground',
        )}
      >
        <span className="flex-1 truncate text-left">{group.label}</span>
        <ChevronRight
          aria-hidden
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-200',
            isOpen && 'rotate-90',
          )}
        />
      </button>

      <div
        id={contentId}
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="relative mt-0.5 space-y-0.5 pb-1">
            {/* Guide line tying the children to their parent. */}
            <span aria-hidden className="absolute bottom-1 left-[1.1rem] top-0 w-px bg-border" />
            {modules.map((module) => (
              <NavItem key={module.key} module={module} depth={1} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */

const NavGroupFlyout = ({ group, modules }: { group: NavGroup; modules: ModuleDefinition[] }) => {
  const { pathname } = useLocation();
  const containsActive = modules.some((module) => isModuleActive(pathname, module));
  const Icon = resolveIcon(modules[0]?.icon ?? 'LayoutGrid');

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={group.label}
          className={cn(
            'flex size-9 items-center justify-center rounded-md transition-colors',
            'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            containsActive && 'bg-accent text-accent-foreground',
          )}
        >
          <Icon className={cn('size-4', containsActive && 'text-primary')} strokeWidth={2} />
        </button>
      </PopoverTrigger>

      <PopoverContent side="right" align="start" sideOffset={8} className="w-56 p-1.5">
        <p className="px-2 pb-1 pt-0.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          {group.label}
        </p>
        <div className="space-y-0.5">
          {modules.map((module) => (
            <NavItem key={module.key} module={module} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

/* ------------------------------------------------------------------ */

export const SidebarNav = ({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) => {
  const { canAccessModule } = usePermissions();

  const tree = useMemo<NavNode[]>(
    () => buildNavTree((module) => canAccessModule(module.key)),
    [canAccessModule],
  );

  if (collapsed) {
    return (
      <nav aria-label="Main navigation" className="flex flex-col items-center gap-1 py-3">
        {tree.map((node, index) =>
          node.type === 'item' ? (
            <Hint key={node.module.key} label={node.module.label} side="right">
              <NavLink
                to={node.module.path}
                aria-label={node.module.label}
                className={({ isActive }) =>
                  cn(
                    'flex size-9 items-center justify-center rounded-md transition-colors',
                    'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    isActive && 'bg-accent text-accent-foreground',
                  )
                }
              >
                {({ isActive }) => {
                  const Icon = resolveIcon(node.module.icon);
                  return (
                    <Icon className={cn('size-4', isActive && 'text-primary')} strokeWidth={2} />
                  );
                }}
              </NavLink>
            </Hint>
          ) : (
            <div key={node.group.key} className="contents">
              {index > 0 ? <span aria-hidden className="my-1 h-px w-6 bg-border" /> : null}
              <NavGroupFlyout group={node.group} modules={node.modules} />
            </div>
          ),
        )}
      </nav>
    );
  }

  return (
    <nav aria-label="Main navigation" className="space-y-0.5 px-2 py-3">
      {tree.map((node) =>
        node.type === 'item' ? (
          <NavItem key={node.module.key} module={node.module} onNavigate={onNavigate} />
        ) : (
          <NavGroupSection
            key={node.group.key}
            group={node.group}
            modules={node.modules}
            onNavigate={onNavigate}
          />
        ),
      )}
    </nav>
  );
};
