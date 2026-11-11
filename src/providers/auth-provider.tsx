"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { logoutRequest } from "@/lib/api/client";
import type { Role, SessionUser } from "@/types/api";

interface AuthContextValue {
  user: SessionUser;
  isAdmin: boolean;
  hasRole: (role: Role) => boolean;
  signOut: () => Promise<void>;
  isSigningOut: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Holds the signed-in identity for the dashboard tree.
 *
 * The user is passed in from a server component that read the httpOnly session
 * cookie, so the first paint already knows who is signed in — no loading
 * flicker, and no round trip to find out.
 *
 * This is for rendering decisions only: which navigation items to show, which
 * panels to request. It is not an authorisation boundary. Every ADMIN endpoint
 * is enforced by Spring Security, so hiding a link is a courtesy to the user,
 * not a control.
 */
export function AuthProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOut = useCallback(async () => {
    setIsSigningOut(true);
    try {
      await logoutRequest();
    } catch {
      // The handler clears the cookies regardless, so there is nothing useful
      // to tell the user here — they asked to leave, and they are leaving.
    } finally {
      // Drop every cached response before navigating. Without this, signing in
      // as somebody else would briefly show the previous user's data from
      // cache while the new queries run.
      queryClient.clear();
      router.replace("/login");
      // The layout above is a server component that read the session cookie,
      // so the tree has to be re-fetched for the redirect to stick.
      router.refresh();
      setIsSigningOut(false);
    }
  }, [queryClient, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAdmin: user.roles.includes("ADMIN"),
      hasRole: (role: Role) => user.roles.includes(role),
      signOut,
      isSigningOut,
    }),
    [user, signOut, isSigningOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
}
