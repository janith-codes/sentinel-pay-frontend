"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/states";
import { formatAmount, formatCount, formatDayLabel } from "@/lib/utils";
import type { DailyVolume } from "@/types/api";

/**
 * Daily completed payment volume.
 *
 * ---------------------------------------------------------------------------
 * Why bars and not an area or a line
 * ---------------------------------------------------------------------------
 * The backend documents that "days with no activity are absent rather than
 * reported as zero". A line or an area joins the points it is given, so a week
 * with payments on Monday and Friday would be drawn as a continuous slope
 * across the three quiet days in between — inventing activity that did not
 * happen. Bars can only occupy the days that exist, which is the truthful
 * shape for a sparse series.
 *
 * ---------------------------------------------------------------------------
 * Why one currency at a time
 * ---------------------------------------------------------------------------
 * The API reports volume per (day, currency) and never sums across currencies,
 * on the grounds that a total in no particular currency is meaningless. This
 * follows that: when more than one currency is present the user picks, rather
 * than being shown a stack whose height means nothing.
 *
 * One series, so there is no legend — the heading names it. Colour here is a
 * magnitude, not an identity, hence a single hue.
 */
export function VolumeChart({ daily }: { daily: DailyVolume[] }) {
  const currencies = useMemo(
    () => [...new Set(daily.map((entry) => entry.currency))].sort(),
    [daily],
  );

  const [selected, setSelected] = useState<string | null>(null);
  const currency = selected ?? currencies[0] ?? null;

  const series = useMemo(
    () =>
      daily
        .filter((entry) => entry.currency === currency)
        // The API does not promise an order, and a time axis has to be sorted.
        .sort((a, b) => a.day.localeCompare(b.day))
        .map((entry) => ({
          day: entry.day,
          label: formatDayLabel(entry.day),
          // Recharts needs a number to lay out a bar. The precise decimal
          // string is carried alongside and is what the tooltip prints, so
          // nothing the user reads has been through a float.
          value: Number(entry.completedAmount),
          exact: entry.completedAmount,
          completedCount: entry.completedCount,
          paymentCount: entry.paymentCount,
        })),
    [daily, currency],
  );

  if (daily.length === 0 || !currency) {
    return (
      <EmptyState
        title="No completed payments in this window"
        description="Volume is drawn from completed payments only. Days with no activity are omitted rather than shown as zero."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {currencies.length > 1 ? (
        // Filters sit in one row above the chart.
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Currency"
        >
          {currencies.map((code) => (
            <Button
              key={code}
              size="sm"
              variant={code === currency ? "default" : "outline"}
              aria-pressed={code === currency}
              onClick={() => setSelected(code)}
            >
              {code}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={series}
            margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
            barCategoryGap="22%"
          >
            {/* Horizontal rules only, and recessive: the grid is a reading
                aid, not part of the data. */}
            <CartesianGrid
              horizontal
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(value: number) =>
                new Intl.NumberFormat("en-US", {
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(value)
              }
            />
            <Tooltip
              cursor={{ fill: "var(--accent)", opacity: 0.5 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0]
                  .payload as (typeof series)[number];
                return (
                  <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-[var(--shadow-overlay)]">
                    <p className="font-medium text-popover-foreground">
                      {point.label}
                    </p>
                    <p className="numeric mt-1 text-sm font-semibold text-popover-foreground">
                      {formatAmount(point.exact, currency)}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {formatCount(point.completedCount)} completed of{" "}
                      {formatCount(point.paymentCount)} submitted
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="value"
              fill="var(--chart-single)"
              /* Rounded top only: the bottom is anchored to the baseline and
                 rounding it would lift the bar off its own zero. */
              radius={[4, 4, 0, 0]}
              maxBarSize={44}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/*
        The table alternative. A canvas chart is unreadable to a screen reader
        and to anyone who cannot distinguish the bars, so the same figures are
        available as real tabular data.
      */}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          View as table
        </summary>
        <div className="DataTable-wrapper mt-3 max-h-72 overflow-auto rounded-lg border">
          <table className="DataTable text-sm">
            <caption className="visually-hidden">
              Daily completed payment volume in {currency}
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="border-b px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground"
                >
                  Day
                </th>
                <th
                  scope="col"
                  className="border-b px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground"
                >
                  Completed volume
                </th>
                <th
                  scope="col"
                  className="border-b px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground"
                >
                  Completed
                </th>
                <th
                  scope="col"
                  className="border-b px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground"
                >
                  Submitted
                </th>
              </tr>
            </thead>
            <tbody>
              {series.map((point) => (
                <tr key={point.day} className="border-b last:border-0">
                  <td data-label="Day" className="px-3 py-2">
                    {point.label}
                  </td>
                  <td
                    data-label="Completed volume"
                    className="numeric px-3 py-2 text-right"
                  >
                    {formatAmount(point.exact, currency)}
                  </td>
                  <td
                    data-label="Completed"
                    className="numeric px-3 py-2 text-right"
                  >
                    {formatCount(point.completedCount)}
                  </td>
                  <td
                    data-label="Submitted"
                    className="numeric px-3 py-2 text-right"
                  >
                    {formatCount(point.paymentCount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
