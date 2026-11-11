import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { DashboardContent } from "@/features/dashboard/dashboard-content";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Figures are aggregated from persisted transactions on every request. Nothing here is cached or estimated."
      />
      <DashboardContent />
    </>
  );
}
