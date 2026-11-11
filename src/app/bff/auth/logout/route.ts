/**
 * POST /bff/auth/logout
 *
 * Revokes the session upstream, then clears the cookies here.
 *
 * The local clear happens whatever the backend says. Logout that can fail is
 * not logout: if the revocation store is unreachable the backend answers 503,
 * and leaving the user signed in at that point would be the wrong answer to
 * the only question they asked. The access token is short-lived and the
 * refresh token is discarded here, so the exposure from a revocation that did
 * not land is bounded by the access token's remaining lifetime.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { logout } from "@/lib/auth/token-exchange";
import { ACCESS_TOKEN_COOKIE, clearSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json(
      {
        type: "/errors/cross-site-request",
        status: 403,
        detail: "Cross-site requests are not accepted.",
      },
      { status: 403, headers: { "content-type": "application/problem+json" } },
    );
  }

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  if (accessToken) {
    try {
      await logout(accessToken);
    } catch (error) {
      // Logged, not surfaced. See the note at the top of this file.
      console.warn("Upstream logout did not complete:", error);
    }
  }

  const response = new NextResponse(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });

  clearSession(response.cookies);
  return response;
}
