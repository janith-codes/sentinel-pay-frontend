import { Suspense } from "react";
import type { Metadata } from "next";

import { PaymentsView } from "@/features/payments/payments-view";

export const metadata: Metadata = {
  title: "Payments",
};

export default function PaymentsPage() {
  return (
    // The view reads its filters from the query string, which is a dynamic
    // read; the boundary is what keeps that from opting the whole route out of
    // static rendering.
    <Suspense
      fallback={
        <div
          className="h-96 animate-pulse rounded-[--radius-card] bg-muted"
          aria-hidden="true"
        />
      }
    >
      <PaymentsView />
    </Suspense>
  );
}
