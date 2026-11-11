"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock,
  CreditCard,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/shared/metric-card";
import {
  CapabilityNote,
  ErrorState,
  ForbiddenState,
  PanelSkeleton,
} from "@/components/shared/states";
import { PaymentsTable } from "@/features/payments/payments-table";
import { VolumeChart } from "@/features/dashboard/volume-chart";
import {
  useDashboardOverview,
  usePaymentVolume,
} from "@/features/dashboard/use-dashboard";
import { messageFromError } from "@/lib/api/problem";
import {
  formatAmount,
  formatCount,
  formatDate,
  formatPercent,
} from "@/lib/utils";

/**
 * The administrator overview.
 *
 * Both panels come from `/api/v1/admin/dashboard`, which aggregates in the
 * database and caches nothing — the backend's own reasoning being that a
 * dashboard disagreeing with the ledger makes an operator distrust both.
 */
export function AdminOverview({ window }: { window: { from: string } }) {
  const overview = useDashboardOverview(window);
  const volume = usePaymentVolume(window);

  const payments = overview.data?.payments;
  const accounts = overview.data?.accounts;

  /**
   * Completed volume per currency.
   *
   * Reported as a list, never summed. Adding an amount in LKR to one in USD
   * produces a figure denominated in nothing, which is why the backend returns
   * one entry per currency and why this does not flatten them.
   */
  const completedTotals = useMemo(
    () => payments?.completedTotals ?? [],
    [payments],
  );

  if (overview.isForbidden) {
    return (
      <ForbiddenState description="The dashboard aggregation endpoints are restricted to the ADMIN role by the backend's filter chain." />
    );
  }

  if (overview.isError) {
    return (
      <ErrorState
        message={messageFromError(overview.error)}
        onRetry={() => void overview.refetch()}
      />
    );
  }

  const isLoading = overview.isLoading;
  const total = payments?.totalPayments ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* ---------------------------------------------------------------
          Volume. One tile per currency, because there is no single total.
      --------------------------------------------------------------- */}
      <section
        aria-labelledby="volume-heading"
        className="flex flex-col gap-3"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="volume-heading" className="text-sm font-semibold">
            Completed payment volume
          </h2>
          {overview.data ? (
            <p className="text-xs text-muted-foreground">
              {formatDate(overview.data.window.from)} –{" "}
              {formatDate(overview.data.window.to)}
            </p>
          ) : null}
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <PanelSkeleton key={index} className="h-28" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {completedTotals.length === 0 ? (
              <MetricCard
                label="Completed volume"
                Icon={TrendingUp}
                tone="info"
                value="—"
                caption="No completed payments in this window."
              />
            ) : (
              completedTotals.map((entry) => (
                <MetricCard
                  key={entry.currency}
                  label={`Volume · ${entry.currency}`}
                  Icon={TrendingUp}
                  tone="info"
                  value={formatAmount(entry.amount, entry.currency)}
                  caption={`${formatCount(entry.count)} completed payments`}
                />
              ))
            )}

            <MetricCard
              label="Total balance held"
              Icon={Wallet}
              tone="neutral"
              value={formatAmount(accounts?.totalBalance)}
              caption={`Across ${formatCount(accounts?.totalAccounts)} accounts`}
            />
          </div>
        )}

        {/*
          The backend ships this caveat in the payload itself
          (`accounts.totalBalanceNote`), so it is surfaced rather than
          paraphrased or dropped.
        */}
        {accounts?.totalBalanceNote ? (
          <CapabilityNote>
            <span className="font-medium">On the balance figure: </span>
            {accounts.totalBalanceNote}
          </CapabilityNote>
        ) : null}
      </section>

      {/* ---------------------------------------------------------------
          Outcomes
      --------------------------------------------------------------- */}
      <section aria-labelledby="outcomes-heading" className="flex flex-col gap-3">
        <h2 id="outcomes-heading" className="text-sm font-semibold">
          Payment outcomes
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Completed"
            Icon={CheckCircle2}
            tone="success"
            isLoading={isLoading}
            value={formatCount(payments?.completedPayments)}
            caption={
              payments
                ? `${formatPercent(payments.completedPayments, total)} of ${formatCount(total)} submitted`
                : undefined
            }
          />
          <MetricCard
            label="Pending"
            Icon={Clock}
            tone="info"
            isLoading={isLoading}
            value={formatCount(payments?.countsByStatus?.PENDING ?? 0)}
            caption="Accepted, still processing"
          />
          <MetricCard
            label="Failed"
            Icon={XCircle}
            tone="danger"
            isLoading={isLoading}
            value={formatCount(payments?.failedPayments)}
            caption="Errored while processing"
          />
          {/*
            Kept distinct from "failed" because the backend keeps them
            distinct: a rejection is the fraud assessment refusing a payment
            on purpose, which is the system working, not breaking.
          */}
          <MetricCard
            label="Fraud rejected"
            Icon={Ban}
            tone="warning"
            isLoading={isLoading}
            value={formatCount(payments?.fraudRejectedPayments)}
            caption="Refused by fraud assessment"
          />
        </div>
      </section>

      {/* ---------------------------------------------------------------
          Volume over time
      --------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Daily completed volume</CardTitle>
        </CardHeader>
        <CardContent>
          {volume.isForbidden ? (
            <ForbiddenState description="Volume aggregation is restricted to the ADMIN role." />
          ) : volume.isError ? (
            <ErrorState
              message={messageFromError(volume.error)}
              onRetry={() => void volume.refetch()}
            />
          ) : volume.isLoading ? (
            <PanelSkeleton className="h-64" label="Loading volume chart" />
          ) : (
            <>
              <VolumeChart daily={volume.data?.daily ?? []} />
              {/*
                The endpoint is named `/revenue` and answers with
                `revenueModel: "NOT_AVAILABLE"`. Showing volume under a
                "revenue" heading would be the one genuinely misleading thing
                this screen could do, so the backend's own note is printed.
              */}
              {volume.data?.revenueNote ? (
                <CapabilityNote className="mt-4">
                  <span className="font-medium">
                    This is volume, not revenue.{" "}
                  </span>
                  {volume.data.revenueNote}
                </CapabilityNote>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

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
            payments={overview.data?.recentPayments}
            isLoading={isLoading}
            showRiskScore
            showAccount
            emptyTitle="No payments in this window"
            emptyDescription="Nothing has been submitted in the selected period."
          />
        </CardContent>
      </Card>

      {/* A pointer to where the ADMIN-only operational view lives. */}
      <Card className="flex-row items-center justify-between gap-4 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-600">
            <CreditCard className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium">Event delivery</p>
            <p className="text-xs text-muted-foreground">
              Outbox health and any payment events stranded before the broker.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/operations">
            Operations
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </Card>
    </div>
  );
}
