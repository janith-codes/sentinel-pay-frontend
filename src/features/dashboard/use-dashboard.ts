"use client";

import { useQuery } from "@tanstack/react-query";

import { getDashboardOverview, getPaymentVolume } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { ApiError } from "@/lib/api/problem";

/**
 * Both hooks are ADMIN-only, because both endpoints are.
 *
 * `enabled` is passed from the page based on the signed-in role, so a USER
 * never fires a request that can only come back 403. Hiding a panel is not a
 * security measure — the filter chain enforces the restriction — but spending
 * a request and a slice of the rate-limit budget to be refused is pure waste.
 *
 * A 403 that does arrive anyway is surfaced rather than retried: it is a
 * settled answer about who the caller is, and no number of retries will change
 * it.
 */

function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.isForbidden;
}

export function useDashboardOverview(
  window: { from: string; to?: string },
  options: { enabled?: boolean } = {},
) {
  const query = useQuery({
    queryKey: queryKeys.dashboard.overview(window.from, window.to),
    queryFn: ({ signal }) =>
      getDashboardOverview({ from: window.from, to: window.to }, signal),
    enabled: options.enabled ?? true,
    retry: false,
  });

  return { ...query, isForbidden: isForbidden(query.error) };
}

/**
 * Payment volume per day, for the chart.
 *
 * The endpoint is `/admin/dashboard/revenue` and deliberately answers with
 * `revenueModel: "NOT_AVAILABLE"`: a transaction records an amount and no fee,
 * commission or platform share, so revenue cannot be derived from it. What
 * comes back is volume — money that moved — and the UI labels it as such.
 */
export function usePaymentVolume(
  window: { from: string; to?: string },
  options: { enabled?: boolean } = {},
) {
  const query = useQuery({
    queryKey: queryKeys.dashboard.volume(window.from, window.to),
    queryFn: ({ signal }) =>
      getPaymentVolume({ from: window.from, to: window.to }, signal),
    enabled: options.enabled ?? true,
    retry: false,
  });

  return { ...query, isForbidden: isForbidden(query.error) };
}
