import {
  LayoutDashboard,
  CreditCard,
  Wallet,
  Settings,
  Radio,
  type LucideIcon,
} from "lucide-react";

import type { Role, SessionUser } from "@/types/api";

export interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
  /** Omit for an item every signed-in role may see. */
  requiresRole?: Role;
  /** One line in the drawer, under the label. */
  description: string;
}

/**
 * The navigation.
 *
 * Only routes the backend can actually serve appear here. "Operations" is
 * included because the outbox administration endpoints exist and are genuinely
 * useful — a parked event is a committed payment whose event never reached the
 * broker, and nothing else in the system surfaces that. It is ADMIN-gated
 * because the endpoints are.
 *
 * Hiding an item is a convenience, not a control: `/api/v1/admin/**` is
 * restricted by the Spring Security filter chain, and the use cases check the
 * role a second time. A USER who typed the URL would get a 403 problem
 * document from the backend, which is what the page then renders.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    Icon: LayoutDashboard,
    description: "Volume, outcomes and recent activity",
  },
  {
    href: "/payments",
    label: "Payments",
    Icon: CreditCard,
    description: "Search and inspect the ledger",
  },
  {
    href: "/accounts",
    label: "Accounts",
    Icon: Wallet,
    description: "Balances and account status",
  },
  {
    href: "/operations",
    label: "Operations",
    Icon: Radio,
    requiresRole: "ADMIN",
    description: "Outbox health and stranded events",
  },
  {
    href: "/settings",
    label: "Settings",
    Icon: Settings,
    description: "Session and platform details",
  },
];

export function visibleNavItems(user: SessionUser | null): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => !item.requiresRole || user?.roles.includes(item.requiresRole),
  );
}

/**
 * Whether a nav item is the active one.
 *
 * Prefix match on a path boundary, so `/payments/abc` keeps "Payments" lit
 * without `/payments-archive` also matching it.
 */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
