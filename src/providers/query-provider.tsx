"use client";

import { useState } from "react";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { ApiError } from "@/lib/api/problem";

/**
 * TanStack Query configuration.
 *
 * Two decisions worth stating:
 *
 * `retry` refuses to repeat anything the backend answered with a 4xx. Retrying
 * a 401, 403, 404 or 422 cannot succeed, and retrying a 429 is how a rate
 * limit becomes a lockout — the backend allows 10 logins and 60 payments a
 * minute, and three automatic retries would spend that budget on the user's
 * behalf.
 *
 * A 401 anywhere means the refresh token is gone or spent, which the proxy has
 * already acted on by clearing the cookies. The handler below sends the
 * browser to the login page so the user sees a login form rather than a screen
 * of failed panels.
 */
function onUnauthenticated(error: unknown): void {
  if (!(error instanceof ApiError) || !error.isUnauthenticated) return;
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;

  const next = `${window.location.pathname}${window.location.search}`;
  // `replace`, so the dead page does not sit in the back history.
  window.location.replace(`/login?next=${encodeURIComponent(next)}`);
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: onUnauthenticated }),
    mutationCache: new MutationCache({ onError: onUnauthenticated }),
    defaultOptions: {
      queries: {
        // Ledger figures go stale the moment a payment lands, but a dashboard
        // that refetches on every focus change is a dashboard that spends the
        // rate-limit budget on nothing. Half a minute is the compromise.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            if (error.status >= 400 && error.status < 500) return false;
            // 503 means a dependency is down and a retry is the backend's own
            // advice, so it is allowed — but only once.
            if (error.status === 503) return failureCount < 1;
          }
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
      },
      mutations: {
        // A mutation is never retried automatically. A payment is the obvious
        // reason: the idempotency key makes a *deliberate* retry safe, but an
        // automatic one would fire while the first is still in flight.
        retry: false,
      },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Created in state, not at module scope: a module-level client would be
  // shared between requests on the server and leak one user's cache into
  // another's render.
  const [client] = useState(createQueryClient);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
