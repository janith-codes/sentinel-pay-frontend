"use client";

import Link from "next/link";
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/shared/metric-card";
import { AccountStatusBadge } from "@/components/shared/status-badge";
import { CapabilityNote, ErrorState } from "@/components/shared/states";
import { PaymentsTable } from "@/features/payments/payments-table";
import { usePaymentHistory, usePaymentStatusCounts } from "@/features/payments/use-payments";
import { useOwnAccount } from "@/features/accounts/use-accounts";
import { messageFromError } from "@/lib/api/problem";
import { formatAmount, formatCount, formatPercent } from "@/lib/utils";

/**
 * The account holder overview.
 *
 * ---------------------------------------------------------------------------
 * What this screen can and cannot show
 * ---------------------------------------------------------------------------
 * The backend has exactly one aggregation endpoint and it is ADMIN-only. For a
 * USER there is no equivalent, so this is assembled from the two endpoints an
 * account holder may read:
 *
 *  - `GET /accounts/me` for the balance and account status.
 *  - `GET /payments` for the history, and for the per-status counts, which
 *    come from `totalElements` on a status-filtered page — a real count, done
 *    in the database, not a tally of one page of rows.
 *
 * Total completed *volume* is the one figure that genuinely cannot be
 * obtained: summing amounts is something only the ADMIN aggregation does, and
 * adding up a page of rows in the browser would give a total for that page
 * rather than for the account. That tile says so instead of showing a number
 * that is quietly wrong.
 */
export function UserOverview() {
  const account = useOwnAccount();
  const statusCounts = usePaymentStatusCounts();
  const recent = usePaymentHistory({ page: 0, size: 10 });

  const { counts, total } = statusCounts;

  return (
    <div className="flex flex-col gap-6">
      {/* ---------------------------------------------------------------
          Account
      --------------------------------------------------------------- */}
      <section aria-labelledby="account-heading" className="flex flex-col gap-3">
        <h2 id="account-heading" className="text-sm font-semibold">
          Your account
        </h2>

        {account.isError ? (
          <ErrorState
            message={messageFromError(account.error)}
            onRetry={() => void account.refetch()}
          />
        ) : account.isNotFound ? (
          <CapabilityNote>
            No payment account is linked to this identity. The backend answers{" "}
            <code className="font-mono text-xs">404</code> for{" "}
            <code className="font-mono text-xs">/accounts/me</code> in that
            case, which is the normal state for an administrative login.
            Linking an account to an identity is done when the account is
            provisioned.
          </CapabilityNote>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Balance"
              Icon={Wallet}
              tone="info"
              isLoading={account.isLoading}
              value={formatAmount(account.data?.balance)}
              caption={
                account.data ? (
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[0.7rem]">
                      {account.data.accountNumber}
                    </span>
                    <AccountStatusBadge status={account.data.status} />
                  </span>
                ) : undefined
              }
            />

            <MetricCard
              label="Payments submitted"
              Icon={TrendingUp}
              tone="neutral"
              isLoading={statusCounts.isLoading}
              value={formatCount(total)}
              caption="All outcomes, all time"
            />

            <MetricCard
              label="Completed"
              Icon={CheckCircle2}
              tone="success"
              isLoading={statusCounts.isLoading}
              value={formatCount(counts.COMPLETED ?? 0)}
              caption={
                total
                  ? `${formatPercent(counts.COMPLETED ?? 0, total)} of submitted`
                  : undefined
              }
            />

            {/*
              The honest tile. The USER-readable API exposes no endpoint that
              sums amounts, and totalling the rows of one page would silently
              be a per-page figure.
            */}
            <MetricCard
              label="Completed volume"
              Icon={TrendingUp}
              tone="neutral"
              unavailable="Amount totals are aggregated only by the administrator dashboard endpoint, which this role cannot read."
            />
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------
          Outcomes
      --------------------------------------------------------------- */}
      <section aria-labelledby="outcomes-heading" className="flex flex-col gap-3">
        <h2 id="outcomes-heading" className="text-sm font-semibold">
          Payment outcomes
        </h2>

        {statusCounts.isError ? (
          <ErrorState
            message={messageFromError(statusCounts.error)}
            onRetry={statusCounts.refetch}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Pending"
              Icon={Clock}
              tone="info"
              isLoading={statusCounts.isLoading}
              value={formatCount(counts.PENDING ?? 0)}
              caption="Accepted, still processing"
            />
            <MetricCard
              label="Failed"
              Icon={XCircle}
              tone="danger"
              isLoading={statusCounts.isLoading}
              value={formatCount(counts.FAILED ?? 0)}
              caption="Errored while processing"
            />
            <MetricCard
              label="Rejected"
              Icon={Ban}
              tone="warning"
              isLoading={statusCounts.isLoading}
              value={formatCount(counts.REJECTED ?? 0)}
              caption="Refused by fraud assessment"
            />
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------
          Recent activity
      --------------------------------------------------------------- */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle className="text-sm">Recent payments</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/payments">
              View all
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <PaymentsTable
            payments={recent.data?.content}
            isLoading={recent.isLoading}
            error={recent.isError ? messageFromError(recent.error) : null}
            onRetry={() => void recent.refetch()}
            // The backend returns `riskScore: null` to an account holder, so
            // the column would be nothing but dashes.
            showRiskScore={false}
            // Every row is this account, so the column carries no information.
            showAccount={false}
            emptyTitle="No payments yet"
            emptyDescription="Payments submitted from this account will appear here."
          />
        </CardContent>
      </Card>
    </div>
  );
}
