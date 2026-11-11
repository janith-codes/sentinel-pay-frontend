
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentDetailView } from "@/features/payments/payment-detail-view";

export const metadata: Metadata = {
  title: "Payment",
};

/**
 * A payment at its own URL, so it can be linked to from a ticket, a chat or an
 * email and survive a refresh.
 *
 * The id is validated here rather than forwarded blindly. It comes from the
 * path, so it is attacker-controlled; the backend would answer 400 for a
 * non-UUID, but spending a request — and a slice of the caller's rate-limit
 * budget — to be told that is pointless when the shape is checkable locally.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `searchParams` carries the list's filters through, so "Back to payments"
 * returns to the exact view the user left rather than an unfiltered page 1.
 */
export default async function PaymentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const resolved = await searchParams;

  const backSearch =
    typeof resolved.back === "string" ? resolved.back : undefined;

  if (!UUID_PATTERN.test(id)) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <p className="font-medium">Not a payment id</p>
          <p className="max-w-md text-sm text-muted-foreground">
            A payment id is a UUID. This link does not contain one, so there is
            nothing to look up.
          </p>
          <code className="font-mono text-xs break-all text-muted-foreground">
            {id}
          </code>
          <Button variant="outline" size="sm" className="mt-2" asChild>
            <Link href="/payments">Back to payments</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No Suspense boundary here, on purpose. `PaymentDetailView` is a client
  // component that fetches through TanStack Query and renders its own loading
  // skeleton, so it never suspends — a boundary around it would only ever show
  // its fallback for the instant before hydration, duplicating a loading state
  // that already exists. The segment's `loading.tsx` covers navigation itself.
  return <PaymentDetailView paymentId={id} backSearch={backSearch} />;
}
