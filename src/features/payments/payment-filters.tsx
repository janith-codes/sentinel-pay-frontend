"use client";

import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PAYMENT_SORT_FIELDS,
  TRANSACTION_STATUSES,
  type PaymentHistoryQuery,
  type PaymentSortField,
  type SortDirection,
  type TransactionStatus,
} from "@/types/api";

/**
 * Filters for the ledger.
 *
 * Every control here maps onto a query parameter the backend actually accepts
 * (`PaymentController.getPaymentHistory`), and the sort options are exactly the
 * `PaymentSortField` enum. That enum is a closed set on purpose — the backend
 * will not order by an arbitrary column name — so offering a free-text sort
 * field would only produce 400s.
 *
 * Filtering, ordering and paging all happen in the database. None of it is done
 * in the browser, so these are genuinely narrowing the query rather than
 * hiding rows that were already fetched.
 */

/** Sentinel for "no status filter" — Radix Select cannot hold an empty value. */
const ANY_STATUS = "__any__";

const SORT_LABELS: Record<PaymentSortField, string> = {
  CREATED_AT: "Submitted",
  PROCESSED_AT: "Processed",
  AMOUNT: "Amount",
  STATUS: "Status",
};

export function PaymentFilters({
  query,
  onChange,
  onReset,
  hasFilters,
  showAccountFilter,
}: {
  query: PaymentHistoryQuery;
  onChange: (next: PaymentHistoryQuery) => void;
  onReset: () => void;
  hasFilters: boolean;
  /** ADMIN only: a USER asking for another account is refused with 403. */
  showAccountFilter: boolean;
}) {
  /** Any filter change resets to the first page — page 3 of a new filter is meaningless. */
  function update(patch: Partial<PaymentHistoryQuery>) {
    onChange({ ...query, ...patch, page: 0 });
  }

  return (
    <div className="flex flex-col gap-4 rounded-[--radius-card] border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-status" className="text-xs">
            Status
          </Label>
          <Select
            value={query.status ?? ANY_STATUS}
            onValueChange={(value) =>
              update({
                status:
                  value === ANY_STATUS
                    ? undefined
                    : (value as TransactionStatus),
              })
            }
          >
            <SelectTrigger id="filter-status" className="h-10">
              <SelectValue placeholder="Any status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_STATUS}>Any status</SelectItem>
              {TRANSACTION_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.charAt(0) + status.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-reference" className="text-xs">
            Reference
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="filter-reference"
              /*
                Keyed on the committed value so the field re-mounts when the
                filter changes from outside — a Back navigation restoring the
                URL, or "Clear filters". An uncontrolled input with only
                `defaultValue` would keep showing the stale text.
              */
              key={query.reference ?? ""}
              // An identifier, so no autocorrect or capitalisation.
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Idempotency key"
              className="h-10 pl-9"
              defaultValue={query.reference ?? ""}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  update({
                    reference: event.currentTarget.value.trim() || undefined,
                  });
                }
              }}
              onBlur={(event) => {
                const value = event.currentTarget.value.trim() || undefined;
                if (value !== query.reference) update({ reference: value });
              }}
              aria-describedby="filter-reference-hint"
            />
          </div>
          <p id="filter-reference-hint" className="text-xs text-muted-foreground">
            Exact match on the submitted idempotency key.
          </p>
        </div>

        {showAccountFilter ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-account" className="text-xs">
              Account
            </Label>
            <Input
              id="filter-account"
              key={query.accountId ?? ""}
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Account UUID"
              className="h-10 font-mono text-xs"
              defaultValue={query.accountId ?? ""}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  update({
                    accountId: event.currentTarget.value.trim() || undefined,
                  });
                }
              }}
              onBlur={(event) => {
                const value = event.currentTarget.value.trim() || undefined;
                if (value !== query.accountId) update({ accountId: value });
              }}
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-sort" className="text-xs">
            Order by
          </Label>
          <div className="flex gap-2">
            <Select
              value={query.sort ?? "CREATED_AT"}
              onValueChange={(value) =>
                update({ sort: value as PaymentSortField })
              }
            >
              <SelectTrigger id="filter-sort" className="h-10 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_SORT_FIELDS.map((field) => (
                  <SelectItem key={field} value={field}>
                    {SORT_LABELS[field]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              className="size-10 shrink-0"
              aria-label={
                (query.direction ?? "DESC") === "DESC"
                  ? "Sorted descending. Switch to ascending."
                  : "Sorted ascending. Switch to descending."
              }
              onClick={() =>
                update({
                  direction: (
                    (query.direction ?? "DESC") === "DESC" ? "ASC" : "DESC"
                  ) as SortDirection,
                })
              }
            >
              <span aria-hidden="true">
                {(query.direction ?? "DESC") === "DESC" ? "↓" : "↑"}
              </span>
            </Button>
          </div>
        </div>
      </div>

      {hasFilters ? (
        <div className="flex items-center justify-end">
          <Button variant="ghost" size="sm" onClick={onReset}>
            <X aria-hidden="true" />
            Clear filters
          </Button>
        </div>
      ) : null}
    </div>
  );
}
