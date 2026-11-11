import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { SettingsView } from "@/features/settings/settings-view";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Your session, and what this console can and cannot do against the current backend."
      />
      <SettingsView />
    </>
  );
}
