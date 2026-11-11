import Link from "next/link";

import { Brand } from "@/components/layout/brand";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { EnvironmentBadge } from "@/components/layout/environment-badge";

/**
 * The permanent sidebar, from `lg` upwards.
 *
 * Hidden rather than collapsed below that breakpoint — the same navigation is
 * reachable from the drawer, and two nav trees in the accessibility tree at
 * once would be announced twice.
 */
export function Sidebar() {
  return (
    <aside className="hidden w-72 shrink-0 flex-col bg-sidebar lg:flex">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <Link
          href="/dashboard"
          className="rounded text-sidebar-foreground transition-opacity hover:opacity-90"
        >
          <Brand />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <SidebarNav />
      </div>

      <div className="border-t border-sidebar-border p-4">
        <EnvironmentBadge />
      </div>
    </aside>
  );
}
