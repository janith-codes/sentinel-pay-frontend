"use client";

import { usePathname } from "next/navigation";

import { MobileNav } from "@/components/layout/mobile-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { isActive, visibleNavItems } from "@/components/layout/nav-items";
import { useAuth } from "@/providers/auth-provider";

export function Topbar() {
  const pathname = usePathname();
  const { user } = useAuth();

  // The nav table already names every route, so the heading comes from there
  // rather than from a second list that could drift out of step with it.
  const current = visibleNavItems(user).find((item) =>
    isActive(pathname, item.href),
  );

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b bg-card/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-5">
      <MobileNav />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-muted-foreground lg:text-base lg:font-semibold lg:text-foreground">
          {current?.label ?? "SentinelPay"}
        </p>
      </div>

      <UserMenu />
    </header>
  );
}
