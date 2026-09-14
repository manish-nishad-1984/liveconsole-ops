import {
  Bell,
  Building2,
  Boxes,
  FileText,
  History,
  LayoutDashboard,
  LayoutGrid,
  MapPin,
  Truck,
  Receipt,
  Scale,
  Settings,
  ShieldCheck,
  Tags,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/**
 * The module registry in `@liveconsole-ops/shared` is framework-agnostic and
 * stores icons as names. This is where those names become React components — the
 * one place the shared package's string identifiers meet lucide.
 *
 * Only the icons the registry actually names are imported, so the bundle carries
 * the navigation set rather than the whole library. Add yours here when you add a
 * module.
 */
const ICONS: Record<string, LucideIcon> = {
  Bell,
  Boxes,
  Building2,
  FileText,
  History,
  LayoutDashboard,
  LayoutGrid,
  MapPin,
  Truck,
  Receipt,
  Scale,
  Settings,
  ShieldCheck,
  Tags,
  UserCog,
  Users,
  Wallet,
};

/** Falls back to a neutral glyph so an unmapped name never crashes the sidebar. */
export const resolveIcon = (name: string): LucideIcon => ICONS[name] ?? LayoutGrid;
