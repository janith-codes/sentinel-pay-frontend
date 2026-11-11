"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  PAGE_DEFAULT_SIZE,
  PAGE_MAX_SIZE,
  PAYMENT_SORT_FIELDS,
  TRANSACTION_STATUSES,
  type PaymentHistoryQuery,
  type PaymentSortField,
  type SortDirection,
  type TransactionStatus,
} from "@/types/api";

/**
 * Payment list filters, held in the URL rather than in component state.
 *
 * ---------------------------------------------------------------------------
 * Why the URL
 * ---------------------------------------------------------------------------
 * Rows now link to `/payments/{id}`, so the list unmounts whenever anyone
 * opens a payment. With the filters in `useState` that would silently reset
 * them — an operator who filtered to failed payments on page 4, opened one and
 * pressed Back would land on an unfiltered page 1, which is the kind of small
 * betrayal that makes a tool exhausting to use.
 *
 * In the URL, the browser's own history restores them, and the view becomes
 * shareable: "the failed payments for this account" is a link you can paste
 * into a ticket.
 *
 * Every value is re-validated on the way out. Query strings are user-editable,
 * and a hand-typed `?status=BANANA` must not be forwarded to the backend to
 * come back a 400 — an unrecognised value is simply dropped.
 */

const DEFAULTS = {
  page: 0,
  size: PAGE_DEFAULT_SIZE,
  sort: "CREATED_AT" as PaymentSortField,
  direction: "DESC" as SortDirection,
};

function parseStatus(raw: string | null): TransactionStatus | undefined {
  if (!raw) return undefined;
  return (TRANSACTION_STATUSES as readonly string[]).includes(raw)
    ? (raw as TransactionStatus)
    : undefined;
}

function parseSort(raw: string | null): PaymentSortField {
  if (!raw) return DEFAULTS.sort;
  return (PAYMENT_SORT_FIELDS as readonly string[]).includes(raw)
    ? (raw as PaymentSortField)
    : DEFAULTS.sort;
}

function parseDirection(raw: string | null): SortDirection {
  return raw === "ASC" ? "ASC" : DEFAULTS.direction;
}

function parsePage(raw: string | null): number {
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isInteger(value) && value >= 0 ? value : DEFAULTS.page;
}

function parseSize(raw: string | null): number {
  const value = Number.parseInt(raw ?? "", 10);
  // The backend rejects anything above MAX_SIZE outright, so clamp rather than
  // spend a request learning that.
  if (!Number.isInteger(value) || value < 1) return DEFAULTS.size;
  return Math.min(value, PAGE_MAX_SIZE);
}

/** A UUID, or nothing. Anything else would be a 400 from the backend. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseAccountId(raw: string | null): string | undefined {
  if (!raw) return undefined;
  return UUID_PATTERN.test(raw.trim()) ? raw.trim() : undefined;
}

export interface PaymentQueryParams {
  /** Ready to hand to the history endpoint. */
  query: PaymentHistoryQuery;
  /** Replaces the filters and returns to the first page. */
  setFilters: (next: PaymentHistoryQuery) => void;
  /** Changes the page, leaving the filters alone. */
  setPage: (page: number) => void;
  /** Clears everything back to defaults. */
  reset: () => void;
  /** True when any narrowing filter is applied. */
  hasFilters: boolean;
  /** The current search string, for linking back to this exact view. */
  search: string;
}

export function usePaymentQueryParams(): PaymentQueryParams {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = useMemo<PaymentHistoryQuery>(
    () => ({
      status: parseStatus(searchParams.get("status")),
      reference: searchParams.get("reference")?.trim() || undefined,
      accountId: parseAccountId(searchParams.get("accountId")),
      page: parsePage(searchParams.get("page")),
      size: parseSize(searchParams.get("size")),
      sort: parseSort(searchParams.get("sort")),
      direction: parseDirection(searchParams.get("direction")),
    }),
    [searchParams],
  );

  const write = useCallback(
    (next: PaymentHistoryQuery) => {
      const params = new URLSearchParams();

      // Defaults are omitted, so an untouched list has a clean `/payments`
      // rather than a URL restating what the backend would do anyway.
      if (next.status) params.set("status", next.status);
      if (next.reference) params.set("reference", next.reference);
      if (next.accountId) params.set("accountId", next.accountId);
      if (next.page && next.page !== DEFAULTS.page) {
        params.set("page", String(next.page));
      }
      if (next.size && next.size !== DEFAULTS.size) {
        params.set("size", String(next.size));
      }
      if (next.sort && next.sort !== DEFAULTS.sort) {
        params.set("sort", next.sort);
      }
      if (next.direction && next.direction !== DEFAULTS.direction) {
        params.set("direction", next.direction);
      }

      const serialised = params.toString();

      // `replace`, not `push`: adjusting a filter is refining one view, not
      // moving to a new one. Pushing would bury the page the user arrived from
      // under an entry per keystroke-worth of filtering.
      router.replace(serialised ? `${pathname}?${serialised}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router],
  );

  const setFilters = useCallback(
    (next: PaymentHistoryQuery) => {
      // Page 3 of a different filter is a page that means nothing.
      write({ ...next, page: 0 });
    },
    [write],
  );

  const setPage = useCallback(
    (page: number) => write({ ...query, page }),
    [query, write],
  );

  const reset = useCallback(
    () => write({ size: query.size, sort: query.sort, direction: query.direction }),
    [query.size, query.sort, query.direction, write],
  );

  const hasFilters = Boolean(
    query.status || query.reference || query.accountId,
  );

  return {
    query,
    setFilters,
    setPage,
    reset,
    hasFilters,
    search: searchParams.toString(),
  };
}
