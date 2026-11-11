"use client";

import { ChevronDown, LogOut, Settings, ShieldCheck, User } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/providers/auth-provider";

/** Two initials from a username, for the avatar. */
function initialsOf(username: string): string {
  const parts = username.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return username.slice(0, 2).toUpperCase();
}

export function UserMenu() {
  const { user, isAdmin, signOut, isSigningOut } = useAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-11 gap-2 px-2"
          aria-label={`Account menu for ${user.username}`}
        >
          <span
            className="grid size-8 shrink-0 place-items-center rounded-full bg-navy-100 text-xs font-semibold text-navy-800"
            aria-hidden="true"
          >
            {initialsOf(user.username)}
          </span>
          <span className="hidden min-w-0 flex-col items-start leading-tight sm:flex">
            <span className="max-w-32 truncate text-sm font-medium">
              {user.username}
            </span>
            <span className="text-xs text-muted-foreground">
              {isAdmin ? "Administrator" : "Account holder"}
            </span>
          </span>
          <ChevronDown
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="truncate font-medium">{user.username}</span>
          <span className="flex flex-wrap items-center gap-1">
            {user.roles.map((role) => (
              <span
                key={role}
                className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-1.5 py-0.5 text-[0.7rem] font-medium text-navy-700"
              >
                {role === "ADMIN" ? (
                  <ShieldCheck className="size-3" aria-hidden="true" />
                ) : (
                  <User className="size-3" aria-hidden="true" />
                )}
                {role}
              </span>
            ))}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings aria-hidden="true" />
            Settings
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          disabled={isSigningOut}
          onSelect={(event) => {
            // The menu would otherwise close before the request is sent.
            event.preventDefault();
            void signOut();
          }}
        >
          <LogOut aria-hidden="true" />
          {isSigningOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
