"use client";

import { AlertCircle, Info, Lock, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Nothing here yet, and that is not an error. */
export function EmptyState({
  title,
  description,
  Icon = Info,
  action,
  className,
}: {
  title: string;
  description?: string;
  Icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 px-6 py-12 text-center",
        className,
      )}
    >
      <Icon className="size-8 text-ink-300" aria-hidden="true" />
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Something the user asked for failed. */
export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex flex-col items-center gap-2 px-6 py-12 text-center",
        className,
      )}
    >
      <AlertCircle className="size-8 text-danger-500" aria-hidden="true" />
      <p className="font-medium">Could not load this</p>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/**
 * A panel the signed-in role may not read.
 *
 * Shown instead of silently hiding the panel, so an operator can tell the
 * difference between "there is nothing here" and "this is not yours to see".
 */
export function ForbiddenState({
  title = "Administrator access required",
  description,
  className,
}: {
  title?: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 px-6 py-12 text-center",
        className,
      )}
    >
      <Lock className="size-8 text-ink-300" aria-hidden="true" />
      <p className="font-medium">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

/**
 * A limitation of the backend, stated in the interface.
 *
 * Used where the API genuinely does not expose something the screen would
 * otherwise show. Keeping these visible is deliberate: the alternative is a
 * dashboard that looks complete and quietly misleads.
 */
export function CapabilityNote({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "flex-row items-start gap-3 border-info-200 bg-info-50 p-3.5",
        className,
      )}
    >
      <Info
        className="mt-0.5 size-4 shrink-0 text-info-700"
        aria-hidden="true"
      />
      <div className="text-sm leading-relaxed text-info-700">{children}</div>
    </Card>
  );
}

/** Placeholder block matching the height of the panel it stands in for. */
export function PanelSkeleton({
  className,
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <>
      <div
        className={cn("animate-pulse rounded-[--radius-card] bg-muted", className)}
        aria-hidden="true"
      />
      <span className="visually-hidden" role="status">
        {label}
      </span>
    </>
  );
}
