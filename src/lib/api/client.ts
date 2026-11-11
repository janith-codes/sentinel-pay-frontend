/**
 * The browser-side API client.
 *
 * Every call goes to this app's own origin under `/bff/api/...`, which the
 * route handler forwards to `<backend>/api/v1/...` with the access token
 * attached. There is no API host in this file, and no token: the browser has
 * neither.
 *
 * This is the only place a request is constructed. Feature code calls the
 * typed helpers below and never touches `fetch`, so header handling, error
 * translation and query-string encoding exist once.
 */
import { ApiError, toApiError } from "@/lib/api/problem";
import type {
  Account,
  AccountListQuery,
  CreateAccountBody,
  CreatePaymentBody,
  DashboardOverview,
  OutboxHealth,
  PagedResponse,
  ParkedEvent,
  PaymentDetail,
  PaymentHistoryQuery,
  PaymentResult,
  PaymentVolume,
  RedriveResult,
  SessionUser,
} from "@/types/api";

const BFF_API = "/bff/api";

/** Serialises a query object, dropping anything unset. */
function toSearchParams(
  query: Record<string, string | number | boolean | undefined | null>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const serialised = params.toString();
  return serialised ? `?${serialised}` : "";
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Extra headers. Used for `Idempotency-Key` on payments. */
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * One request to the backend, via the proxy.
 *
 * `T = void` for a 204, which several endpoints answer with.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, headers = {}, signal } = options;

  const response = await fetch(`${BFF_API}${path}`, {
    method,
    headers: {
      accept: "application/json",
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    // Same origin, so the session cookie rides along without `include`.
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/** POST /bff/auth/login — returns the identity, never a token. */
export async function loginRequest(
  username: string,
  password: string,
): Promise<SessionUser> {
  const response = await fetch("/bff/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ username, password }),
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  return (await response.json()) as SessionUser;
}

export async function logoutRequest(): Promise<void> {
  const response = await fetch("/bff/auth/logout", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
  });

  // A failed logout still clears the cookies server-side, so treat anything
  // short of a network error as done.
  if (!response.ok && response.status !== 204) {
    throw new ApiError(response.status, "Sign out did not complete cleanly.");
  }
}

// ---------------------------------------------------------------------------
// Payments — /api/v1/payments
// ---------------------------------------------------------------------------

export function getPaymentHistory(
  query: PaymentHistoryQuery = {},
  signal?: AbortSignal,
): Promise<PagedResponse<PaymentDetail>> {
  return apiRequest<PagedResponse<PaymentDetail>>(
    `/payments${toSearchParams({ ...query })}`,
    { signal },
  );
}

export function getPayment(
  paymentId: string,
  signal?: AbortSignal,
): Promise<PaymentDetail> {
  return apiRequest<PaymentDetail>(
    `/payments/${encodeURIComponent(paymentId)}`,
    { signal },
  );
}

/**
 * POST /api/v1/payments.
 *
 * The idempotency key is generated here rather than left to the backend so a
 * retry of the *same* submission cannot take the money twice. The backend
 * generates one when the header is absent, which would make every retry a new
 * payment.
 */
export function createPayment(
  body: CreatePaymentBody,
  idempotencyKey: string,
): Promise<PaymentResult> {
  return apiRequest<PaymentResult>("/payments", {
    method: "POST",
    body,
    headers: { "idempotency-key": idempotencyKey },
  });
}

// ---------------------------------------------------------------------------
// Accounts — /api/v1/accounts
// ---------------------------------------------------------------------------

/** GET /api/v1/accounts/me — 404 for an identity with no account (an admin). */
export function getOwnAccount(signal?: AbortSignal): Promise<Account> {
  return apiRequest<Account>("/accounts/me", { signal });
}

export function getAccount(
  accountId: string,
  signal?: AbortSignal,
): Promise<Account> {
  return apiRequest<Account>(
    `/accounts/${encodeURIComponent(accountId)}`,
    { signal },
  );
}

/** ADMIN only. */
export function createAccount(body: CreateAccountBody): Promise<Account> {
  return apiRequest<Account>("/accounts", { method: "POST", body });
}

/** ADMIN only — GET /api/v1/admin/accounts. */
export function listAccounts(
  query: AccountListQuery = {},
  signal?: AbortSignal,
): Promise<PagedResponse<Account>> {
  return apiRequest<PagedResponse<Account>>(
    `/admin/accounts${toSearchParams({ ...query })}`,
    { signal },
  );
}

// ---------------------------------------------------------------------------
// Dashboard — /api/v1/admin/dashboard (ADMIN only)
// ---------------------------------------------------------------------------

export function getDashboardOverview(
  range: { from?: string; to?: string } = {},
  signal?: AbortSignal,
): Promise<DashboardOverview> {
  return apiRequest<DashboardOverview>(
    `/admin/dashboard/overview${toSearchParams({ ...range })}`,
    { signal },
  );
}

/**
 * GET /api/v1/admin/dashboard/revenue.
 *
 * Named for what it returns. The endpoint is called `revenue` and answers with
 * `revenueModel: "NOT_AVAILABLE"` plus payment volume, because the backend has
 * no fee model to derive revenue from.
 */
export function getPaymentVolume(
  range: { from?: string; to?: string } = {},
  signal?: AbortSignal,
): Promise<PaymentVolume> {
  return apiRequest<PaymentVolume>(
    `/admin/dashboard/revenue${toSearchParams({ ...range })}`,
    { signal },
  );
}

// ---------------------------------------------------------------------------
// Outbox operations — /api/v1/admin/outbox (ADMIN only)
// ---------------------------------------------------------------------------

export function getOutboxHealth(signal?: AbortSignal): Promise<OutboxHealth> {
  return apiRequest<OutboxHealth>("/admin/outbox", { signal });
}

export function listParkedEvents(
  query: { page?: number; size?: number } = {},
  signal?: AbortSignal,
): Promise<PagedResponse<ParkedEvent>> {
  return apiRequest<PagedResponse<ParkedEvent>>(
    `/admin/outbox/parked${toSearchParams({ ...query })}`,
    { signal },
  );
}

export function redriveEvent(eventId: string): Promise<void> {
  return apiRequest<void>(
    `/admin/outbox/parked/${encodeURIComponent(eventId)}/redrive`,
    { method: "POST" },
  );
}

export function redriveAllParked(): Promise<RedriveResult> {
  return apiRequest<RedriveResult>("/admin/outbox/parked/redrive", {
    method: "POST",
  });
}
