"use client";

import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { RefetchingIndicator } from "@/components/shared/data-table";
import { PaymentFilters } from "@/features/payments/payment-filters";
import { PaymentsTable } from "@/features/payments/payments-table";
import { NewPaymentDialog } from "@/features/payments/new-payment-dialog";
import { usePaymentHistory } from "@/features/payments/use-payments";
import { usePaymentQueryParams } from "@/features/payments/use-payment-query-params";
import { useOwnAccount } from "@/features/accounts/use-accounts";
import { messageFromError } from "@/lib/api/problem";
import { useAuth } from "@/providers/auth-provider";

export function PaymentsView() {
  const { isAdmin } = useAuth();

  // Filters live in the URL, so opening a payment and coming back restores
  // this exact view, and the view itself is a shareable link.
  const { query, setFilters, setPage, reset, hasFilters, search } =
    usePaymentQueryParams();

  const history = usePaymentHistory(query);
  // Pre-fills the payment form for an account holder. An ADMIN has no linked
  // account, so this would 404 for them — hence `enabled`.
  const ownAccount = useOwnAccount({ enabled: !isAdmin });

  return (
    <>
      <PageHeader
        title="Payments"
        description={
          isAdmin
            ? "Every payment across all accounts. Filtering, ordering and paging are all done in the database."
            : "Payments taken from your account. Only your own account is ever returned, whatever the filter asks for."
        }
        actions={
          <NewPaymentDialog account={isAdmin ? undefined : ownAccount.data} />
        }
      />

      <PaymentFilters
        query={query}
        onChange={setFilters}
        onReset={reset}
        hasFilters={hasFilters}
        // A USER naming another account is refused with 403, so the control is
        // not offered to them.
        showAccountFilter={isAdmin}
      />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex min-h-5 items-center justify-end">
            {/* Distinguishes "loading the first page" from "refreshing rows
                that are already on screen", which the placeholder data makes
                otherwise invisible. */}
            <RefetchingIndicator
              active={history.isFetching && !history.isLoading}
            />
          </div>

          <PaymentsTable
            payments={history.data?.content}
            isLoading={history.isLoading}
            error={history.isError ? messageFromError(history.error) : null}
            onRetry={() => void history.refetch()}
            showRiskScore={isAdmin}
            showAccount={isAdmin}
            backSearch={search}
            emptyTitle={
              hasFilters ? "No payments match these filters" : "No payments yet"
            }
            emptyDescription={
              hasFilters
                ? "Try widening or clearing the filters."
                : "Submitted payments will appear here."
            }
          />

          {history.data ? (
            <Pagination
              result={history.data}
              noun="payments"
              isBusy={history.isFetching}
              onPageChange={setPage}
            />
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
