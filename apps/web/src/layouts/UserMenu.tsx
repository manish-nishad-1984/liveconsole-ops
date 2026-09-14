import { ChevronDown, KeyRound, LogOut, Monitor, Moon, Sun, User as UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { UserAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ROUTES } from '@/routes/paths';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore, type Density, type Theme } from '@/store/ui.store';

export const UserMenu = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const density = useUiStore((state) => state.density);
  const setDensity = useUiStore((state) => state.setDensity);

  if (!user) return null;

  /** Primary role is enough for the header; the rest are on the profile page. */
  const roleLabel = user.isSuperAdmin
    ? 'Super Administrator'
    : (user.roles[0]?.name ?? user.designation ?? 'No role assigned');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5 sm:px-2">
          <UserAvatar name={user.fullName} src={user.avatarUrl} className="size-7" />
          <span className="hidden min-w-0 text-left sm:block">
            <span className="block max-w-[9rem] truncate text-xs font-medium leading-tight">
              {user.fullName}
            </span>
            <span className="block max-w-[9rem] truncate text-2xs text-muted-foreground">
              {roleLabel}
            </span>
          </span>
          <ChevronDown className="hidden text-muted-foreground sm:block" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-60">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{user.fullName}</p>
          <p className="truncate text-2xs text-muted-foreground">{user.email}</p>
        </div>
        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => navigate(ROUTES.profile)}>
          <UserIcon />
          My profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate(ROUTES.changePassword)}>
          <KeyRound />
          Change password
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
          <DropdownMenuRadioItem value="light">
            <Sun />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor />
            System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Table density</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={density}
          onValueChange={(value) => setDensity(value as Density)}
        >
          <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => void logout()}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
