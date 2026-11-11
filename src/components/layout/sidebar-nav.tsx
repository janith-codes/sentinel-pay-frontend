"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { isActive, visibleNavItems } from "@/components/layout/nav-items";
import { useAuth } from "@/providers/auth-provider";

/**
 * The navigation list, shared by the desktop sidebar and the mobile drawer.
 *
 * `aria-current="page"` marks the active item rather than colour alone, so the
 * current location is announced and not merely shown.
 */
export function SidebarNav({
  onNavigate,
  className,
}: {
  /** Called after a link is chosen — the drawer uses it to close. */
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const items = visibleNavItems(user);

  return (
    <nav aria-label="Main" className={cn("px-3", className)}>
      <ul className="flex flex-col gap-1">
        {items.map(({ href, label, Icon, description }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  // 44px minimum height: a comfortable tap target.
                  "min-h-11",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon
                  className="mt-0.5 size-4.5 shrink-0"
                  aria-hidden="true"
                />
                <span className="flex min-w-0 flex-col">
                  <span>{label}</span>
                  <span
                    className={cn(
                      "mt-0.5 text-xs leading-snug",
                      active
                        ? "text-sidebar-accent-foreground/70"
                        : "text-sidebar-foreground/55",
                    )}
                  >
                    {description}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
