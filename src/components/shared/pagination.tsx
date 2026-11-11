"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/utils";
import type { PagedResponse } from "@/types/api";

/**
 * Pager for the backend's `PagedResponse`.
 *
 * Page indices are zero-based in the API and one-based on screen, which is the
 * only place that conversion happens.
 *
 * `hasNext` comes from the response rather than being derived from
 * `page < totalPages - 1`, because the backend computes it and a second
 * derivation is a second thing to get wrong.
 */
export function Pagination<T>({
  result,
  onPageChange,
  isBusy = false,
  /** What the rows are, for the count line: "payments", "accounts". */
  noun,
}: {
  result: Pick<
    PagedResponse<T>,
    "page" | "size" | "totalElements" | "totalPages" | "hasNext"
  >;
  onPageChange: (page: number) => void;
  isBusy?: boolean;
  noun: string;
}) {
  const { page, size, totalElements, totalPages, hasNext } = result;

  if (totalElements === 0) return null;

  const firstRow = page * size + 1;
  const lastRow = Math.min(firstRow + size - 1, totalElements);

  return (
    <nav
      className="flex flex-col gap-3 border-t px-1 pt-3 sm:flex-row sm:items-center sm:justify-between"
      aria-label={`${noun} pagination`}
    >
      {/* `polite`: the count changes as a result of the user's own click, so
          it should be announced, but never interrupt. */}
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing <span className="numeric font-medium">{formatCount(firstRow)}</span>
        {"–"}
        <span className="numeric font-medium">{formatCount(lastRow)}</span> of{" "}
        <span className="numeric font-medium">{formatCount(totalElements)}</span>{" "}
        {noun}
      </p>

      <div className="flex items-center gap-2">
        <span className="numeric text-sm text-muted-foreground">
          Page {page + 1} of {Math.max(totalPages, 1)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0 || isBusy}
        >
          <ChevronLeft aria-hidden="true" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext || isBusy}
        >
          Next
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
