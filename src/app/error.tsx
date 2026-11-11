"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Root error boundary.
 *
 * Catches what the per-panel error states do not: a render-time failure
 * anywhere in the tree. It deliberately shows the user nothing from `error`
 * except the digest — a stack trace or raw message can name internal modules
 * and, worse, echo request data back into the page. The detail goes to the
 * console, which is where a developer is looking anyway.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error in the SentinelPay console:", error);
  }, [error]);

  return (
    <div className="grid min-h-svh place-items-center bg-background px-5">
      <div
        role="alert"
        className="flex max-w-md flex-col items-center gap-3 text-center"
      >
        <span className="grid size-12 place-items-center rounded-full bg-danger-50 text-danger-700">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </span>
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          The console hit an unexpected error. Nothing was submitted on your
          behalf — if you were in the middle of a payment, check the payments
          list before trying again.
        </p>
        {error.digest ? (
          <p className="text-xs text-muted-foreground">
            Reference <code className="font-mono">{error.digest}</code>
          </p>
        ) : null}
        <Button onClick={reset} className="mt-2">
          <RotateCcw aria-hidden="true" />
          Try again
        </Button>
      </div>
    </div>
  );
}
