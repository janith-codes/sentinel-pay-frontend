"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import {
  DataCell,
  DataRow,
  DataTable,
  DataTableBody,
  DataTableHead,
  HeaderCell,
  TableEmptyState,
  TableErrorState,
  TableSkeleton,
} from "@/components/shared/data-table";
import {
  PaymentStatusBadge,
  RiskScoreBadge,
} from "@/components/shared/status-badge";
import { CopyableId } from "@/components/shared/copyable-id";
import { formatAmount, formatDateTime } from "@/lib/utils";
import type { PaymentDetail } from "@/types/api";

/**
 * The ledger table.
 *
 * Shared by the dashboard activity list and the payments page, so the two
 * cannot drift apart in how a payment is presented.
 *
 * The risk-score column appears only for an ADMIN. That is not a cosmetic
 * choice: the backend returns `riskScore: null` to an account holder, on the
 * grounds that letting one probe the score would let them find the fraud
 * thresholds. Rendering the column for a USER would be a column of dashes.
 */
export function PaymentsTable({
  payments,
  isLoading,
  error,
  onRetry,
  showRiskScore,
  showAccount,
  emptyTitle = "No payments found",
  emptyDescription,
  backSearch,
  linkToDetail = true,
}: {
  payments: PaymentDetail[] | undefined;
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** ADMIN only — the backend withholds the score from other callers. */
  showRiskScore: boolean;
  /** Pointless on a USER's own history, where every row is their account. */
  showAccount: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /**
   * The list's current query string. Carried into the detail link so "Back to
   * payments" returns to this exact filtered page.
   */
  backSearch?: string;
  /** Off for the dashboard's recent list, which is a summary, not a worklist. */
  linkToDetail?: boolean;
}) {
  // One extra column for the row-opening chevron when rows are linked.
  const columns =
    4 + (showAccount ? 1 : 0) + (showRiskScore ? 1 : 0) + (linkToDetail ? 1 : 0);

  function detailHref(paymentId: string): string {
    const base = `/payments/${encodeURIComponent(paymentId)}`;
    return backSearch
      ? `${base}?back=${encodeURIComponent(backSearch)}`
      : base;
  }

  return (
    <DataTable
      caption="Payments, most recent first"
      captionId="payments-table-caption"
    >
      <DataTableHead>
        <DataRow className="hover:bg-transparent">
          <HeaderCell>Payment</HeaderCell>
          {showAccount ? <HeaderCell>Account</HeaderCell> : null}
          <HeaderCell align="end">Amount</HeaderCell>
          <HeaderCell>Status</HeaderCell>
          {showRiskScore ? <HeaderCell align="end">Risk</HeaderCell> : null}
          <HeaderCell>Submitted</HeaderCell>
          {linkToDetail ? (
            <HeaderCell align="end">
              {/* The column holds only the open affordance, so its heading is
                  for screen readers rather than for the eye. */}
              <span className="visually-hidden">Open payment</span>
            </HeaderCell>
          ) : null}
        </DataRow>
      </DataTableHead>

      {error ? (
        <TableErrorState columns={columns} message={error} onRetry={onRetry} />
      ) : isLoading ? (
        <TableSkeleton columns={columns} />
      ) : !payments || payments.length === 0 ? (
        <TableEmptyState
          columns={columns}
          title={emptyTitle}
          description={emptyDescription}
        />
      ) : (
        <DataTableBody>
          {payments.map((payment) => (
            <DataRow key={payment.paymentId}>
              <DataCell label="Payment">
                <CopyableId value={payment.paymentId} label="payment id" />
              </DataCell>

              {showAccount ? (
                <DataCell label="Account">
                  <CopyableId value={payment.accountId} label="account id" />
                </DataCell>
              ) : null}

              <DataCell label="Amount" align="end" numeric>
                <span className="font-medium">
                  {formatAmount(payment.amount, payment.currency)}
                </span>
              </DataCell>

              <DataCell label="Status">
                <PaymentStatusBadge status={payment.status} />
              </DataCell>

              {showRiskScore ? (
                <DataCell label="Risk" align="end">
                  <RiskScoreBadge score={payment.riskScore} />
                </DataCell>
              ) : null}

              <DataCell label="Submitted">
                {/* `time` with a machine-readable datetime, so the value is
                    parseable as well as human-readable. */}
                <time
                  dateTime={payment.createdAt}
                  className="numeric text-muted-foreground"
                >
                  {formatDateTime(payment.createdAt)}
                </time>
              </DataCell>

              {linkToDetail ? (
                <DataCell label="" align="end">
                  {/*
                    A real link, not a click handler on the row. The row holds
                    its own interactive controls — the copy buttons — and
                    nesting those inside a clickable row makes every copy also
                    a navigation. A link is also openable in a new tab, which
                    a `onClick` row is not, and reachable by keyboard without
                    inventing key handling.
                  */}
                  <Link
                    href={detailHref(payment.paymentId)}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-accent"
                  >
                    View
                    <span className="visually-hidden">
                      {` payment ${payment.paymentId}`}
                    </span>
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </DataCell>
              ) : null}
            </DataRow>
          ))}
        </DataTableBody>
      )}
    </DataTable>
  );
}
