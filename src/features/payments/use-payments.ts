"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  useQueries,
} from "@tanstack/react-query";

import {
  createPayment,
  getPayment,
  getPaymentHistory,
} from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { ApiError } from "@/lib/api/problem";
import { TRANSACTION_STATUSES } from "@/types/api";
import type {
  CreatePaymentBody,
  PaymentHistoryQuery,
  PaymentResult,
  TransactionStatus,
} from "@/types/api";

export function usePaymentHistory(query: PaymentHistoryQuery) {
  return useQuery({
    queryKey: queryKeys.payments.list(query),
    queryFn: ({ signal }) => getPaymentHistory(query, signal),
    // Keeps the previous page on screen while the next one loads, so paging
    // does not blank the table and jump the scroll position.
    placeholderData: (previous) => previous,
  });
}

/**
 * One payment by id.
 *
 * A 404 here is a settled answer, not a transient failure, so it is surfaced
 * rather than retried — and it means *either* "no such payment" or "it belongs
 * to an account you may not read". The backend answers both the same way on
 * purpose: a 403 for the second case would confirm the id is real, which is
 * the whole of an enumeration attack. Callers must not present it as "this
 * payment exists but is not yours".
 */
export function usePayment(paymentId: string | null) {
  const query = useQuery({
    queryKey: queryKeys.payments.detail(paymentId ?? ""),
    queryFn: ({ signal }) => getPayment(paymentId!, signal),
    enabled: Boolean(paymentId),
    retry: false,
  });

  const isNotFound = query.error instanceof ApiError && query.error.isNotFound;
  const isForbidden =
    query.error instanceof ApiError && query.error.isForbidden;

  return {
    ...query,
    isNotFound,
    isForbidden,
    // Both are answers rather than faults, and each has its own screen.
    isError: query.isError && !isNotFound && !isForbidden,
  };
}

/**
 * Counts per payment status.
 *
 * ---------------------------------------------------------------------------
 * Why it is done this way
 * ---------------------------------------------------------------------------
 * The backend aggregates payment counts in exactly one place:
 * `GET /api/v1/admin/dashboard/overview`, which is ADMIN-only. An account
 * holder has no aggregate endpoint at all.
 *
 * Rather than show a USER nothing — or worse, invent plausible figures — these
 * counts come from the paged history endpoint, which every signed-in role may
 * read. Asking for `size=1&status=X` returns one row the UI discards and a
 * `totalElements` counted in the database, which is the real total for that
 * status. Four small queries, four true numbers.
 *
 * An ADMIN gets its counts from the overview endpoint instead, in a single
 * request, so this hook is not used there.
 */
export function usePaymentStatusCounts(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;

  const results = useQueries({
    queries: TRANSACTION_STATUSES.map((status) => ({
      queryKey: queryKeys.payments.statusCount(status),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getPaymentHistory({ status, page: 0, size: 1 }, signal),
      enabled,
      select: (page: { totalElements: number }) => page.totalElements,
    })),
  });

  const counts = {} as Record<TransactionStatus, number | undefined>;
  TRANSACTION_STATUSES.forEach((status, index) => {
    counts[status] = results[index]?.data;
  });

  const total = TRANSACTION_STATUSES.reduce(
    (sum, status) => sum + (counts[status] ?? 0),
    0,
  );

  return {
    counts,
    total,
    isLoading: results.some((result) => result.isLoading),
    isError: results.some((result) => result.isError),
    error: results.find((result) => result.error)?.error ?? null,
    refetch: () => {
      for (const result of results) void result.refetch();
    },
  };
}

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation<
    PaymentResult,
    ApiError,
    { body: CreatePaymentBody; idempotencyKey: string }
  >({
    mutationFn: ({ body, idempotencyKey }) =>
      createPayment(body, idempotencyKey),
    onSuccess: () => {
      // The ledger, the balances and every aggregate derived from them have
      // all just changed. Invalidating by prefix rather than listing keys is
      // why query-keys.ts exists.
      void queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      // A completed payment writes an outbox event, so its health changes too.
      void queryClient.invalidateQueries({ queryKey: queryKeys.outbox.all });
    },
  });
}
