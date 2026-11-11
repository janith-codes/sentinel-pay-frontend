import type { Metadata } from "next";

import { AccountsView } from "@/features/accounts/accounts-view";

export const metadata: Metadata = {
  title: "Accounts",
};

export default function AccountsPage() {
  return <AccountsView />;
}
