"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createAccount, getOwnAccount, listAccounts } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { ApiError } from "@/lib/api/problem";
import type { Account, AccountListQuery, CreateAccountBody } from "@/types/api";

/**
 * The caller's own account.
 *
 * A 404 here is an ordinary outcome, not a failure: `GET /accounts/me` answers
 * 404 for an identity with no linked account, which is the normal state of an
 * administrator. It is therefore not retried, and callers are expected to read
 * `isNotFound` rather than treat it as an error.
 */
export function useOwnAccount(options: { enabled?: boolean } = {}) {
  const query = useQuery({
    queryKey: queryKeys.accounts.own,
    queryFn: ({ signal }) => getOwnAccount(signal),
    enabled: options.enabled ?? true,
    retry: false,
  });

  const isNotFound =
    query.error instanceof ApiError && query.error.isNotFound;

  return {
    ...query,
    isNotFound,
    // A 404 is an answer, so it must not surface as an error state.
    isError: query.isError && !isNotFound,
  };
}

/** ADMIN only. */
export function useAccountList(
  query: AccountListQuery,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.accounts.list(query),
    queryFn: ({ signal }) => listAccounts(query, signal),
    enabled: options.enabled ?? true,
    placeholderData: (previous) => previous,
  });
}

/** ADMIN only. */
export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation<Account, ApiError, CreateAccountBody>({
    mutationFn: (body) => createAccount(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
      // The account snapshot on the overview counts accounts per status.
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
