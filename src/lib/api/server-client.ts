/**
 * The backend-for-frontend proxy.
 *
 * ---------------------------------------------------------------------------
 * Why a proxy at all
 * ---------------------------------------------------------------------------
 * Two reasons, and either on its own would be enough.
 *
 * 1. The backend has no CORS configuration. `SecurityConfig` disables CSRF and
 *    sets the session policy to stateless, but never calls `.cors(...)` and no
 *    `CorsConfigurationSource` bean exists anywhere in the repository. A
 *    browser on `localhost:3000` therefore cannot call `localhost:8080`
 *    directly: the preflight gets no `Access-Control-Allow-Origin` and the
 *    request never leaves the browser. The options were to add CORS to the
 *    backend — modifying a module this task is meant to leave alone — or to
 *    make the browser's only origin this Next.js server. This is the latter.
 *
 * 2. It is what lets the tokens stay in httpOnly cookies. The browser holds no
 *    credential; this server attaches one. See lib/auth/session.ts.
 *
 * ---------------------------------------------------------------------------
 * What it does per request
 * ---------------------------------------------------------------------------
 *  - Refuses a mutating request whose `Origin` is not this site (CSRF).
 *  - Refreshes first when the access cookie has expired but the refresh cookie
 *    has not, so a 15-minute token is invisible to the user.
 *  - Retries once on a 401 from upstream, then gives up and clears the session.
 *  - Never forwards our own cookies upstream: the backend is stateless and
 *    authenticates from the `Authorization` header alone.
 */
import "server-only";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { API_BASE_URL, API_PREFIX } from "@/lib/env";
import { ApiError } from "@/lib/api/problem";
import { refreshTokens } from "@/lib/auth/token-exchange";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  clearSession,
  writeSession,
} from "@/lib/auth/session";
import type { AuthTokens, ProblemDetail } from "@/types/api";

/**
 * Request headers worth passing upstream.
 *
 * An allowlist rather than a denylist: anything the frontend has no reason to
 * send should not reach the backend just because a browser decided to add it.
 * `Idempotency-Key` is here because the payment endpoint reads it.
 */
const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "content-type",
  "idempotency-key",
];

/**
 * Response headers worth passing back.
 *
 * The rate-limit trio comes from the backend's `RateLimitFilter` and is useful
 * to the UI; `retry-after` tells it how long to wait.
 */
const FORWARDED_RESPONSE_HEADERS = [
  "content-type",
  "retry-after",
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
];

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function problemResponse(
  status: number,
  type: string,
  detail: string,
): NextResponse {
  // Shaped exactly like the backend's own errors, so the client has one error
  // path rather than two.
  const problem: ProblemDetail = {
    type,
    status,
    detail,
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(problem, {
    status,
    headers: { "content-type": "application/problem+json" },
  });
}

/**
 * Builds the upstream path from the catch-all segments.
 *
 * Returns null for anything that could escape the API prefix. The segments
 * come from the URL, so they are attacker-controlled: without this check a
 * crafted path could turn the proxy into an open relay to any host reachable
 * from the server.
 */
function upstreamPath(segments: string[]): string | null {
  if (segments.length === 0) return null;

  for (const segment of segments) {
    if (
      segment === "" ||
      segment === "." ||
      segment === ".." ||
      segment.includes("/") ||
      segment.includes("\\")
    ) {
      return null;
    }
  }

  return `${API_PREFIX}/${segments.map(encodeURIComponent).join("/")}`;
}

/**
 * Rejects a cross-site mutating request.
 *
 * `SameSite=Lax` already stops the session cookie riding along on a cross-site
 * POST, so this is the second of two independent defences rather than the only
 * one. Requests with no `Origin` header at all are allowed through: that is
 * what a same-origin GET looks like, and the method check has already limited
 * this to mutations, which browsers do send an `Origin` for.
 */
function isCrossSite(request: NextRequest): boolean {
  if (!MUTATING_METHODS.has(request.method)) return false;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin !== new URL(request.url).origin;
  } catch {
    return true;
  }
}

function buildUpstreamHeaders(
  request: NextRequest,
  accessToken: string,
): Headers {
  const headers = new Headers();

  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  headers.set("authorization", `Bearer ${accessToken}`);
  if (!headers.has("accept")) headers.set("accept", "application/json");

  return headers;
}

async function callUpstream(
  request: NextRequest,
  path: string,
  search: string,
  accessToken: string,
  body: ArrayBuffer | null,
): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}${search}`, {
    method: request.method,
    headers: buildUpstreamHeaders(request, accessToken),
    body: body && body.byteLength > 0 ? body : undefined,
    // Ledger reads must not be served from a shared cache.
    cache: "no-store",
    redirect: "manual",
  });
}

function copyResponseHeaders(from: Response, to: NextResponse): void {
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = from.headers.get(name);
    if (value) to.headers.set(name, value);
  }
  // Nothing from an authenticated API belongs in any cache.
  to.headers.set("cache-control", "no-store");
}

/**
 * Proxies one request to the backend.
 *
 * @param segments the catch-all path segments, i.e. everything after
 *                 `/bff/api/`, which map onto `/api/v1/<segments>`
 */
export async function proxyToBackend(
  request: NextRequest,
  segments: string[],
): Promise<NextResponse> {
  if (isCrossSite(request)) {
    return problemResponse(
      403,
      "/errors/cross-site-request",
      "Cross-site requests are not accepted.",
    );
  }

  const path = upstreamPath(segments);
  if (!path) {
    return problemResponse(
      400,
      "/errors/invalid-request",
      "The requested endpoint does not exist.",
    );
  }

  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    return problemResponse(
      401,
      "/errors/no-session",
      "Your session has ended. Please sign in again.",
    );
  }

  // Read the body once: a Request body is a stream and cannot be replayed, and
  // the retry below needs to send it a second time.
  const body = MUTATING_METHODS.has(request.method)
    ? await request.arrayBuffer()
    : null;

  const search = new URL(request.url).search;

  let accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  /** Set when this request performed or shared a refresh; written back below. */
  let rotated: AuthTokens | null = null;

  // The access cookie expires with the token it holds, so its absence means
  // the token has expired — refresh before spending a round trip on a 401.
  if (!accessToken) {
    try {
      rotated = await refreshTokens(refreshToken);
      accessToken = rotated.accessToken;
    } catch (error) {
      return endSession(error);
    }
  }

  let upstream = await callUpstream(request, path, search, accessToken, body);

  // A 401 with a live refresh token means the access token was rejected
  // rather than the session being gone — worth exactly one more attempt.
  if (upstream.status === 401 && !rotated) {
    try {
      rotated = await refreshTokens(refreshToken);
    } catch (error) {
      return endSession(error);
    }
    upstream = await callUpstream(
      request,
      path,
      search,
      rotated.accessToken,
      body,
    );
  }

  // 204 and 304 must not carry a body.
  const hasBody = upstream.status !== 204 && upstream.status !== 304;
  const response = new NextResponse(hasBody ? upstream.body : null, {
    status: upstream.status,
  });

  copyResponseHeaders(upstream, response);

  if (rotated) {
    writeSession(response.cookies, rotated);
  }

  // The session really is finished: clear the cookies so the next navigation
  // goes to the login page instead of looping through a doomed refresh.
  if (upstream.status === 401) {
    clearSession(response.cookies);
  }

  return response;
}

function endSession(error: unknown): NextResponse {
  const detail =
    error instanceof ApiError && error.isUnavailable
      ? "A service this depends on is unavailable. Please retry shortly."
      : "Your session has ended. Please sign in again.";
  const status = error instanceof ApiError && error.isUnavailable ? 503 : 401;

  const response = problemResponse(
    status,
    status === 503 ? "/errors/revocation-unavailable" : "/errors/session-ended",
    detail,
  );

  if (status === 401) {
    clearSession(response.cookies);
  }

  return response;
}
