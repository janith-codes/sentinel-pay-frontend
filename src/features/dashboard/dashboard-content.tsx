"use client";

import { useMemo } from "react";

import { AdminOverview } from "@/features/dashboard/admin-overview";
import { UserOverview } from "@/features/dashboard/user-overview";
import { useAuth } from "@/providers/auth-provider";
import { isoDaysAgo } from "@/lib/utils";

/** Matches the backend's own default window for the overview endpoint. */
const DEFAULT_WINDOW_DAYS = 30;

/**
 * Picks the overview the signed-in role can actually be served.
 *
 * The split is forced by the API rather than chosen for presentation: the
 * aggregation endpoints under `/api/v1/admin/dashboard` are ADMIN-only, so an
 * account holder's overview has to be built from the endpoints they may read.
 * Each variant is described in its own file.
 */
export function DashboardContent() {
  const { isAdmin } = useAuth();

  // Computed once per mount. Recomputing on every render would produce a new
  // `from` instant each time and so a new query key, refetching forever.
  const window = useMemo(
    () => ({ from: isoDaysAgo(DEFAULT_WINDOW_DAYS) }),
    [],
  );

  return isAdmin ? <AdminOverview window={window} /> : <UserOverview />;
}
