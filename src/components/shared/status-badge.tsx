import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ban,
  CircleSlash,
  Snowflake,
  PauseCircle,
  XCircle,
  Send,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  AccountStatus,
  OutboxEventStatus,
  TransactionStatus,
} from "@/types/api";

/**
 * Status pills.
 *
 * Each carries an icon as well as a colour, because colour alone is not an
 * accessible way to communicate state — roughly one in twelve men cannot
 * reliably tell the red pill from the green one.
 *
 * Deliberately not built on the shadcn `Badge`: its variant set is semantic to
 * the design system (`default`, `destructive`, …) rather than to the domain,
 * and the four payment statuses need four distinct treatments.
 */

const BASE =
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs " +
  "font-medium whitespace-nowrap [&>svg]:size-3.5 [&>svg]:shrink-0";

interface Appearance {
  label: string;
  className: string;
  Icon: typeof CheckCircle2;
  /** Spoken by a screen reader in place of the visual treatment. */
  description: string;
}

const PAYMENT: Record<TransactionStatus, Appearance> = {
  COMPLETED: {
    label: "Completed",
    className: "border-success-200 bg-success-50 text-success-700",
    Icon: CheckCircle2,
    description: "Payment completed",
  },
  PENDING: {
    label: "Pending",
    className: "border-info-200 bg-info-50 text-info-700",
    Icon: Clock,
    description: "Payment still processing",
  },
  // A rejection is a deliberate refusal by the fraud assessment, not a
  // malfunction, and is shown differently from a failure for that reason.
  REJECTED: {
    label: "Rejected",
    className: "border-warning-200 bg-warning-50 text-warning-700",
    Icon: Ban,
    description: "Payment refused by fraud assessment",
  },
  FAILED: {
    label: "Failed",
    className: "border-danger-200 bg-danger-50 text-danger-700",
    Icon: XCircle,
    description: "Payment failed while processing",
  },
};

const ACCOUNT: Record<AccountStatus, Appearance> = {
  ACTIVE: {
    label: "Active",
    className: "border-success-200 bg-success-50 text-success-700",
    Icon: CheckCircle2,
    description: "Account can take part in payments",
  },
  SUSPENDED: {
    label: "Suspended",
    className: "border-warning-200 bg-warning-50 text-warning-700",
    Icon: PauseCircle,
    description: "Account suspended",
  },
  FROZEN: {
    label: "Frozen",
    className: "border-info-200 bg-info-50 text-info-700",
    Icon: Snowflake,
    description: "Account frozen",
  },
  CLOSED: {
    label: "Closed",
    className: "border-ink-200 bg-ink-100 text-ink-600",
    Icon: CircleSlash,
    description: "Account closed",
  },
};

const OUTBOX: Record<OutboxEventStatus, Appearance> = {
  PUBLISHED: {
    label: "Published",
    className: "border-success-200 bg-success-50 text-success-700",
    Icon: CheckCircle2,
    description: "Event accepted by the broker",
  },
  PENDING: {
    label: "Pending",
    className: "border-info-200 bg-info-50 text-info-700",
    Icon: Send,
    description: "Event awaiting publication",
  },
  // "FAILED" in the database, "Parked" to an operator: the retry budget is
  // spent and it is waiting for a person, which is what matters here.
  FAILED: {
    label: "Parked",
    className: "border-danger-200 bg-danger-50 text-danger-700",
    Icon: AlertTriangle,
    description: "Event parked after spending its retry budget",
  },
};

function Pill({
  appearance,
  className,
}: {
  appearance: Appearance;
  className?: string;
}) {
  const { Icon, label, className: tone, description } = appearance;
  return (
    <span className={cn(BASE, tone, className)}>
      {/* Decorative: the adjacent text already names the status. */}
      <Icon aria-hidden="true" />
      {label}
      <span className="visually-hidden">{`. ${description}`}</span>
    </span>
  );
}

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: TransactionStatus;
  className?: string;
}) {
  return <Pill appearance={PAYMENT[status]} className={className} />;
}

export function AccountStatusBadge({
  status,
  className,
}: {
  status: AccountStatus;
  className?: string;
}) {
  return <Pill appearance={ACCOUNT[status]} className={className} />;
}

export function OutboxStatusBadge({
  status,
  className,
}: {
  status: OutboxEventStatus;
  className?: string;
}) {
  return <Pill appearance={OUTBOX[status]} className={className} />;
}

/** Fraud risk score, 0–100. ADMIN only; `null` for an account holder. */
export function RiskScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <span className="text-xs text-muted-foreground" title="Visible to administrators only">
        —
      </span>
    );
  }

  // Thresholds for presentation only. The backend owns the actual decision and
  // does not publish where its cut-offs sit.
  const tone =
    score >= 70
      ? "border-danger-200 bg-danger-50 text-danger-700"
      : score >= 40
        ? "border-warning-200 bg-warning-50 text-warning-700"
        : "border-success-200 bg-success-50 text-success-700";

  return (
    <span className={cn(BASE, "numeric", tone)}>
      {score}
      <span className="visually-hidden"> out of 100 risk score</span>
    </span>
  );
}
