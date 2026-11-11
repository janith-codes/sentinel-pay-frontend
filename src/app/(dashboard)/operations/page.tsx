import type { Metadata } from "next";

import { OperationsView } from "@/features/operations/operations-view";

export const metadata: Metadata = {
  title: "Operations",
};

/**
 * ADMIN-only in practice, but not gated here.
 *
 * The page renders and the API refuses: a USER who reaches this URL gets the
 * backend's 403 problem document, which `OperationsView` turns into an
 * explanation. Guarding it in the route as well would mean two places that
 * decide who may see this, and the one that matters is Spring Security.
 */
export default function OperationsPage() {
  return <OperationsView />;
}
