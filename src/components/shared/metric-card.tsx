import { Info, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/**
 * A single figure on the overview.
 *
 * `unavailable` exists because several figures this dashboard would like to
 * show genuinely cannot be obtained from the backend for every caller — total
 * payment volume, for instance, is aggregated only by the ADMIN dashboard
 * endpoint. The tile then says so, in place of the number, rather than
 * rendering a zero or a plausible-looking sample. A dashboard that invents a
 * figure is worse than one that admits it does not have it.
 */
export function MetricCard({
  label,
  value,
  caption,
  Icon,
  tone = "neutral",
  unavailable,
  isLoading = false,
  className,
}: {
  label: string;
  value?: React.ReactNode;
  caption?: React.ReactNode;
  Icon?: LucideIcon;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  /** Why this figure is not available. Replaces the value when set. */
  unavailable?: string;
  isLoading?: boolean;
  className?: string;
}) {
  const toneRing = {
    neutral: "bg-ink-100 text-ink-600",
    success: "bg-success-50 text-success-700",
    warning: "bg-warning-50 text-warning-700",
    danger: "bg-danger-50 text-danger-700",
    info: "bg-info-50 text-info-700",
  }[tone];

  return (
    <Card className={cn("gap-0 p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon ? (
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-lg",
              toneRing,
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      <div className="mt-3">
        {isLoading ? (
          <div
            className="h-8 w-28 animate-pulse rounded bg-muted"
            aria-hidden="true"
          />
        ) : unavailable ? (
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{unavailable}</span>
          </p>
        ) : (
          <p className="numeric text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </p>
        )}
      </div>

      {caption && !isLoading ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{caption}</p>
      ) : null}

      {isLoading ? (
        <span className="visually-hidden" role="status">
          Loading {label}
        </span>
      ) : null}
    </Card>
  );
}
