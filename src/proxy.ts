/**
 * Route guard.
 *
 * Next 16 renamed this file convention from `middleware` to `proxy`; the
 * exported function has to match the filename or it is never invoked, which
 * fails open — every guarded route would render for an anonymous visitor.
 *
 * Keeps unauthenticated visitors out of the dashboard and signed-in users off
 * the login page, before either renders.
 *
 * It tests for the *refresh* cookie, not the access cookie. The access cookie
 * expires every 15 minutes and its absence is routine and recoverable — the
 * proxy refreshes transparently. Gating on it would bounce a perfectly valid
 * session to the login screen a quarter of an hour after signing in.
 *
 * This is a redirect, not an authorisation check. It reads a cookie and does
 * not verify a signature; a forged cookie gets you a dashboard shell whose
 * every request then fails at the backend. Authorisation lives in Spring
 * Security, which is the only place it can be enforced.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const REFRESH_TOKEN_COOKIE = "sp_rt";

const LOGIN_PATH = "/login";
const DEFAULT_SIGNED_IN_PATH = "/dashboard";

/** Where to send someone after signing in, if they asked for somewhere. */
const RETURN_TO_PARAM = "next";

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(
    request.cookies.get(REFRESH_TOKEN_COOKIE)?.value,
  );

  if (pathname === LOGIN_PATH) {
    if (hasSession) {
      return NextResponse.redirect(
        new URL(DEFAULT_SIGNED_IN_PATH, request.url),
      );
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const target = new URL(LOGIN_PATH, request.url);
    // Round-trip the destination so a deep link survives the detour. Only the
    // path is carried, never an absolute URL, so this cannot be used as an
    // open redirect.
    if (pathname !== "/") {
      target.searchParams.set(RETURN_TO_PARAM, `${pathname}${search}`);
    }
    return NextResponse.redirect(target);
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Guarded paths only. `/bff/*` is deliberately absent: those handlers answer
   * with a 401 problem document, which a fetch can act on, whereas a redirect
   * to an HTML login page would arrive at `fetch` as a confusing 200.
   */
  matcher: [
    "/",
    "/login",
    "/dashboard/:path*",
    "/payments/:path*",
    "/accounts/:path*",
    "/operations/:path*",
    "/settings/:path*",
  ],
};
