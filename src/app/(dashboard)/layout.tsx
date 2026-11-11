import { redirect } from "next/navigation";

import { AuthProvider } from "@/providers/auth-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getSessionUser } from "@/lib/auth/session";

/**
 * The authenticated shell.
 *
 * A server component, so the session cookie is read before anything renders
 * and the first paint already knows who is signed in — no loading flash, and
 * no round trip to find out which navigation to draw. The identity is handed
 * down to the client tree through `AuthProvider`.
 *
 * The `redirect` here is a second line after the middleware, not a duplicate
 * of it: middleware only checks that a refresh cookie exists, while this also
 * requires the identity cookie to be parseable. A half-written session ends up
 * at the login page rather than rendering a shell with no user.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <AuthProvider user={user}>
      <div className="flex min-h-svh">
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          {/* The drawer sets `inert` on this element while it is open, so
              nothing behind the overlay is reachable by keyboard. */}
          <main
            id="main-content"
            className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
          >
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}
