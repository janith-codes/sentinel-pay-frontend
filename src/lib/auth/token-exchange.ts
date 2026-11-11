/**
 * Talking to the backend's authentication endpoints.
 *
 * ---------------------------------------------------------------------------
 * Why refresh is single-flighted
 * ---------------------------------------------------------------------------
 * The backend's refresh tokens are single use and rotated: a successful
 * exchange invalidates the token presented and returns a replacement. Crucially,
 * presenting an already-spent token is treated as evidence of compromise and
 * **revokes the entire session** (see AuthController and SessionService in the
 * backend).
 *
 * That makes naive refresh handling actively dangerous. A dashboard typically
 * fires several queries at once; when the access token expires they all get
 * 401 together. If each one independently exchanged the refresh token, the
 * first would succeed and the rest would present a spent token — and the user
 * would be logged out of everything, by their own client, for simply loading a
 * page.
 *
 * So every exchange goes through one in-flight map keyed by the token being
 * spent. Concurrent callers holding the same token await the same promise and
 * share its result. Resolved results are kept briefly afterwards, because a
 * request whose HTTP headers were assembled before the new `Set-Cookie` landed
 * will still arrive carrying the old token — it must be answered from the
 * cache rather than sent upstream to trip the reuse detector.
 *
 * Limitation, stated rather than hidden: this map is per process. Behind more
 * than one Next.js instance without sticky sessions, two instances could still
 * race on the same refresh token. Fixing that properly needs a shared lock
 * (the Redis the backend already runs would do). It is sound for a single
 * instance, which is how this is deployed today.
 */
import "server-only";

import { API_BASE_URL, API_PREFIX } from "@/lib/env";
import { ApiError, toApiError } from "@/lib/api/problem";
import type { AuthTokens } from "@/types/api";

/** How long a completed exchange stays answerable from cache. */
const RESULT_TTL_MS = 60_000;

interface CacheEntry {
  promise: Promise<AuthTokens>;
  /** Set when the promise settles; absent while still in flight. */
  settledAt?: number;
}

const inFlight = new Map<string, CacheEntry>();

function evictExpired(): void {
  const now = Date.now();
  for (const [token, entry] of inFlight) {
    if (entry.settledAt !== undefined && now - entry.settledAt > RESULT_TTL_MS) {
      inFlight.delete(token);
    }
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
    // Credentials are never cached, at any layer.
    cache: "no-store",
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  return (await response.json()) as T;
}

/** Exchanges credentials for a token pair. Throws `ApiError` on refusal. */
export function login(
  username: string,
  password: string,
): Promise<AuthTokens> {
  return postJson<AuthTokens>("/auth/login", { username, password });
}

/**
 * Exchanges a refresh token for a new pair, at most once per token.
 *
 * Callers must use the returned `accessToken` for the request they were about
 * to make, and must write the returned pair back into cookies, or the next
 * request will present the spent token.
 */
export function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  evictExpired();

  const existing = inFlight.get(refreshToken);
  if (existing) {
    return existing.promise;
  }

  const entry: CacheEntry = {
    promise: postJson<AuthTokens>("/auth/refresh", { refreshToken }),
  };

  // Mark the settle time either way. A rejection is cached for the same short
  // window on purpose: if the token was refused, every concurrent caller
  // holding it should learn that without each one asking the backend again.
  entry.promise = entry.promise.then(
    (tokens) => {
      entry.settledAt = Date.now();
      return tokens;
    },
    (error: unknown) => {
      entry.settledAt = Date.now();
      throw error;
    },
  );

  inFlight.set(refreshToken, entry);
  return entry.promise;
}

/**
 * Ends the session the access token belongs to.
 *
 * Idempotent at the backend, and a failure here is deliberately swallowed by
 * the caller: a user who clicks "sign out" must end up signed out locally even
 * if the revocation store is unreachable.
 */
export async function logout(accessToken: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/logout`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok && response.status !== 401) {
    throw await toApiError(response);
  }
}

/** True when an error means "this session is finished". */
export function isSessionEnded(error: unknown): boolean {
  return error instanceof ApiError && error.isUnauthenticated;
}
