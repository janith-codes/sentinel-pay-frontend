"use client";

import { AlertCircle, Inbox, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Table primitives for the ledger views.
 *
 * Built on a real `<table>` with `<thead>`/`<th>` rather than a grid of divs,
 * so screen readers announce row and column relationships and the browser's
 * own table navigation works.
 *
 * Narrow containers restack each row into a card. That transformation is in
 * globals.css under `.DataTable`, driven by a container query, so a table
 * squeezed by the sidebar restacks on its own width rather than the
 * viewport's. Every `<td>` must therefore carry `data-label`, which is the
 * header text injected beside the value once the real `<thead>` is hidden.
 * `DataCell` takes `label` to make that hard to forget.
 */

export function DataTable({
  caption,
  captionId,
  children,
  className,
}: {
  /** Names the table for assistive technology. Visually hidden by default. */
  caption: string;
  captionId: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    // `tabindex=0` + `role=region` so a keyboard user can scroll the table
    // without a pointer; `aria-labelledby` gives that region its name.
    <div
      tabIndex={0}
      role="region"
      aria-labelledby={captionId}
      className={cn("DataTable-wrapper rounded-[--radius-card]", className)}
    >
      <table className="DataTable text-sm">
        <caption id={captionId} className="visually-hidden">
          {caption}
        </caption>
        {children}
      </table>
    </div>
  );
}

export function DataTableHead({ children }: { children: React.ReactNode }) {
  return <thead>{children}</thead>;
}

export function DataTableBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function HeaderCell({
  children,
  align = "start",
  className,
}: {
  children: React.ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b px-3 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase",
        align === "end" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function DataRow({
  children,
  className,
  ...props
}: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "border-b transition-colors last:border-0 hover:bg-accent/40",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function DataCell({
  label,
  children,
  align = "start",
  numeric = false,
  className,
}: {
  /**
   * The column heading. Injected next to the value in the stacked layout,
   * where the real `<thead>` is hidden. Pass `""` for a cell with no heading,
   * such as an actions column.
   */
  label: string;
  children: React.ReactNode;
  align?: "start" | "end";
  /** Tabular figures, so a column of amounts lines up. */
  numeric?: boolean;
  className?: string;
}) {
  return (
    <td
      data-label={label}
      className={cn(
        "px-3 py-2.5 align-middle",
        align === "end" ? "text-right" : "text-left",
        numeric && "numeric",
        className,
      )}
    >
      {children}
    </td>
  );
}

/** Row header. Sticky on wide screens, card header once stacked. */
export function RowHeaderCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="row"
      className={cn(
        "bg-card px-3 py-2.5 text-left font-medium",
        className,
      )}
    >
      {children}
    </th>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

/**
 * Skeleton rows.
 *
 * Same column count and row height as the real table, so the layout does not
 * jump when data arrives.
 */
export function TableSkeleton({
  columns,
  rows = 6,
}: {
  columns: number;
  rows?: number;
}) {
  return (
    <tbody aria-hidden="true">
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr key={rowIndex} className="border-b last:border-0">
          {Array.from({ length: columns }, (_, columnIndex) => (
            // No `data-label`: the stacked layout only injects a label for
            // cells that carry one, so these placeholders stay unlabelled.
            <td key={columnIndex} className="px-3 py-3">
              <div
                className="h-4 animate-pulse rounded bg-muted"
                style={{
                  // Varied widths read as text rather than as a block.
                  width: `${55 + ((rowIndex * 7 + columnIndex * 13) % 40)}%`,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export function TableEmptyState({
  columns,
  title,
  description,
  action,
}: {
  columns: number;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <tbody>
      <tr>
        <td colSpan={columns} data-label="">
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <Inbox className="size-8 text-ink-300" aria-hidden="true" />
            <p className="font-medium">{title}</p>
            {description ? (
              <p className="max-w-sm text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
            {action ? <div className="mt-2">{action}</div> : null}
          </div>
        </td>
      </tr>
    </tbody>
  );
}

export function TableErrorState({
  columns,
  message,
  onRetry,
}: {
  columns: number;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <tbody>
      <tr>
        <td colSpan={columns} data-label="">
          {/* `assertive` because the content the user asked for is not there;
              a polite announcement could sit behind other updates. */}
          <div
            role="alert"
            aria-live="assertive"
            className="flex flex-col items-center gap-2 px-6 py-14 text-center"
          >
            <AlertCircle
              className="size-8 text-danger-500"
              aria-hidden="true"
            />
            <p className="font-medium">Could not load this table</p>
            <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
            {onRetry ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={onRetry}
              >
                Try again
              </Button>
            ) : null}
          </div>
        </td>
      </tr>
    </tbody>
  );
}

/** Subtle indicator for a refetch, when stale rows are still on screen. */
export function RefetchingIndicator({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
      role="status"
    >
      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      Updating
    </span>
  );
}
