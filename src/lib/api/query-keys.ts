import type {
  AccountListQuery,
  PaymentHistoryQuery,
} from "@/types/api";

/**
 * Every cache key in one place.
 *
 * Keys are built here rather than inline at each `useQuery` so that
 * invalidation can be expressed against a prefix and actually hit everything
 * it should. After a payment is submitted, `queryKeys.payments.all` invalidates
 * the history, the detail views and the dashboard counts in one call — which
 * only works if no hook has quietly invented its own key shape.
 */
export const queryKeys = {
  payments: {
    all: ["payments"] as const,
    list: (query: PaymentHistoryQuery) => ["payments", "list", query] as const,
    detail: (paymentId: string) => ["payments", "detail", paymentId] as const,
    /** Per-status totals, derived from `totalElements` on a filtered page. */
    statusCount: (status: string, accountId?: string) =>
      ["payments", "count", status, accountId ?? "all"] as const,
  },
  accounts: {
    all: ["accounts"] as const,
    own: ["accounts", "own"] as const,
    list: (query: AccountListQuery) => ["accounts", "list", query] as const,
    detail: (accountId: string) => ["accounts", "detail", accountId] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
    overview: (from: string, to?: string) =>
      ["dashboard", "overview", from, to ?? "now"] as const,
    volume: (from: string, to?: string) =>
      ["dashboard", "volume", from, to ?? "now"] as const,
  },
  outbox: {
    all: ["outbox"] as const,
    health: ["outbox", "health"] as const,
    parked: (page: number, size: number) =>
      ["outbox", "parked", page, size] as const,
  },
} as const;
