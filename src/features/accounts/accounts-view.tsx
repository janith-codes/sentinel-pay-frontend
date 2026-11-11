"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { MetricCard } from "@/components/shared/metric-card";
import { CapabilityNote, ErrorState } from "@/components/shared/states";
import { AccountStatusBadge } from "@/components/shared/status-badge";
import { CopyableId } from "@/components/shared/copyable-id";
import {
  DataCell,
  DataRow,
  DataTable,
  DataTableBody,
  DataTableHead,
  HeaderCell,
  TableEmptyState,
  TableErrorState,
  TableSkeleton,
} from "@/components/shared/data-table";
import { NewAccountDialog } from "@/features/accounts/new-account-dialog";
import { useAccountList, useOwnAccount } from "@/features/accounts/use-accounts";
import { messageFromError } from "@/lib/api/problem";
import { formatAmount, formatDateTime } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import {
  ACCOUNT_SORT_FIELDS,
  ACCOUNT_STATUSES,
  PAGE_DEFAULT_SIZE,
  type AccountListQuery,
  type AccountSortField,
  type AccountStatus,
} from "@/types/api";

const ANY_STATUS = "__any__";

const SORT_LABELS: Record<AccountSortField, string> = {
  CREATED_AT: "Created",
  ACCOUNT_NUMBER: "Account number",
  BALANCE: "Balance",
  STATUS: "Status",
};

export function AccountsView() {
  const { isAdmin } = useAuth();

  return isAdmin ? <AdminAccounts /> : <OwnAccount />;
}

/**
 * The account holder's view.
 *
 * There is no account listing for a USER — `/api/v1/admin/accounts` is
 * ADMIN-only — and nor should there be: a USER has exactly one account.
 */
function OwnAccount() {
  const account = useOwnAccount();

  return (
    <>
      <PageHeader
        title="Account"
        description="The payment account linked to your identity."
      />

      {account.isError ? (
        <ErrorState
          message={messageFromError(account.error)}
          onRetry={() => void account.refetch()}
        />
      ) : account.isNotFound ? (
        <CapabilityNote>
          No payment account is linked to this identity, so{" "}
          <code className="font-mono text-xs">GET /api/v1/accounts/me</code>{" "}
          answers 404. An account becomes reachable once an identity record
          points at it, which happens when an administrator provisions it.
        </CapabilityNote>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Balance"
              Icon={Wallet}
              tone="info"
              isLoading={account.isLoading}
              value={formatAmount(account.data?.balance)}
              caption="Only a payment changes this figure."
            />
            <MetricCard
              label="Account number"
              isLoading={account.isLoading}
              value={
                <span className="font-mono text-base">
                  {account.data?.accountNumber}
                </span>
              }
            />
            <MetricCard
              label="Status"
              isLoading={account.isLoading}
              value={
                account.data ? (
                  <AccountStatusBadge status={account.data.status} />
                ) : null
              }
              caption={
                account.data
                  ? `Updated ${formatDateTime(account.data.updatedAt)}`
                  : undefined
              }
            />
          </div>

          <CapabilityNote>
            <span className="font-medium">No balance adjustment exists. </span>
            The backend deliberately exposes no endpoint that sets a balance:
            a payment is the only thing that moves money, and it is recorded in
            the ledger. An endpoint that changed a balance directly would leave
            the ledger unable to account for it.
          </CapabilityNote>
        </>
      )}
    </>
  );
}

/** The administrator listing — `GET /api/v1/admin/accounts`. */
function AdminAccounts() {
  const [query, setQuery] = useState<AccountListQuery>({
    page: 0,
    size: PAGE_DEFAULT_SIZE,
    sort: "CREATED_AT",
    direction: "DESC",
  });

  const accounts = useAccountList(query);

  function update(patch: Partial<AccountListQuery>) {
    setQuery((prev) => ({ ...prev, ...patch, page: 0 }));
  }

  const columns = 5;

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Every provisioned account. Ordering always falls back to the account id, so paging cannot repeat or skip a row."
        actions={<NewAccountDialog />}
      />

      <div className="grid gap-3 rounded-[--radius-card] border bg-card p-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-status" className="text-xs">
            Status
          </Label>
          <Select
            value={query.status ?? ANY_STATUS}
            onValueChange={(value) =>
              update({
                status:
                  value === ANY_STATUS ? undefined : (value as AccountStatus),
              })
            }
          >
            <SelectTrigger id="account-status" className="h-10">
              <SelectValue placeholder="Any status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_STATUS}>Any status</SelectItem>
              {ACCOUNT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.charAt(0) + status.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-number" className="text-xs">
            Account number
          </Label>
          <Input
            id="account-number"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="ACC-0001"
            className="h-10"
            defaultValue={query.accountNumber ?? ""}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                update({
                  accountNumber: event.currentTarget.value.trim() || undefined,
                });
              }
            }}
            onBlur={(event) => {
              const value = event.currentTarget.value.trim() || undefined;
              if (value !== query.accountNumber) {
                update({ accountNumber: value });
              }
            }}
            aria-describedby="account-number-hint"
          />
          <p id="account-number-hint" className="text-xs text-muted-foreground">
            Exact match.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-sort" className="text-xs">
            Order by
          </Label>
          <div className="flex gap-2">
            <Select
              value={query.sort ?? "CREATED_AT"}
              onValueChange={(value) =>
                update({ sort: value as AccountSortField })
              }
            >
              <SelectTrigger id="account-sort" className="h-10 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_SORT_FIELDS.map((field) => (
                  <SelectItem key={field} value={field}>
                    {SORT_LABELS[field]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() =>
                update({
                  direction:
                    (query.direction ?? "DESC") === "DESC" ? "ASC" : "DESC",
                })
              }
              aria-label={
                (query.direction ?? "DESC") === "DESC"
                  ? "Sorted descending. Switch to ascending."
                  : "Sorted ascending. Switch to descending."
              }
              className="grid size-10 shrink-0 place-items-center rounded-lg border transition-colors hover:bg-muted"
            >
              <span aria-hidden="true">
                {(query.direction ?? "DESC") === "DESC" ? "↓" : "↑"}
              </span>
            </button>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <DataTable
            caption="Provisioned accounts"
            captionId="accounts-table-caption"
          >
            <DataTableHead>
              <DataRow className="hover:bg-transparent">
                <HeaderCell>Account number</HeaderCell>
                <HeaderCell>Account ID</HeaderCell>
                <HeaderCell align="end">Balance</HeaderCell>
                <HeaderCell>Status</HeaderCell>
                <HeaderCell>Created</HeaderCell>
              </DataRow>
            </DataTableHead>

            {accounts.isError ? (
              <TableErrorState
                columns={columns}
                message={messageFromError(accounts.error)}
                onRetry={() => void accounts.refetch()}
              />
            ) : accounts.isLoading ? (
              <TableSkeleton columns={columns} />
            ) : !accounts.data?.content.length ? (
              <TableEmptyState
                columns={columns}
                title="No accounts match these filters"
                description="Provision an account, or widen the filters."
              />
            ) : (
              <DataTableBody>
                {accounts.data.content.map((account) => (
                  <DataRow key={account.accountId}>
                    <DataCell label="Account number">
                      <span className="font-mono text-xs">
                        {account.accountNumber}
                      </span>
                    </DataCell>
                    <DataCell label="Account ID">
                      <CopyableId
                        value={account.accountId}
                        label="account id"
                      />
                    </DataCell>
                    <DataCell label="Balance" align="end" numeric>
                      <span className="font-medium">
                        {formatAmount(account.balance)}
                      </span>
                    </DataCell>
                    <DataCell label="Status">
                      <AccountStatusBadge status={account.status} />
                    </DataCell>
                    <DataCell label="Created">
                      <time
                        dateTime={account.createdAt}
                        className="numeric text-muted-foreground"
                      >
                        {formatDateTime(account.createdAt)}
                      </time>
                    </DataCell>
                  </DataRow>
                ))}
              </DataTableBody>
            )}
          </DataTable>

          {accounts.data ? (
            <Pagination
              result={accounts.data}
              noun="accounts"
              isBusy={accounts.isFetching}
              onPageChange={(page) => setQuery((prev) => ({ ...prev, page }))}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            What the accounts API does not do
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            There is no endpoint to change a balance, suspend an account, close
            one, or re-link it to a different identity. The backend exposes
            provisioning and reads only.
          </p>
          <p>
            An account is provisioned at a zero balance and cannot be given an
            opening one, because the ledger records only payments and would have
            nothing to account for it with.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
