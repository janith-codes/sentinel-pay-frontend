/**
 * POST /bff/auth/login
 *
 * Takes credentials, exchanges them upstream, and keeps both tokens here. The
 * response carries only `{ username, roles }` — the browser is never given a
 * token to lose.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ApiError, fallbackMessageFor } from "@/lib/api/problem";
import { login } from "@/lib/auth/token-exchange";
import { writeSession } from "@/lib/auth/session";
import type { ProblemDetail, SessionUser } from "@/types/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface LoginBody {
  username?: unknown;
  password?: unknown;
}

function problem(
  status: number,
  type: string,
  detail: string,
  extra: Partial<ProblemDetail> = {},
): NextResponse {
  const body: ProblemDetail = {
    type,
    status,
    detail,
    timestamp: new Date().toISOString(),
    ...extra,
  };
  return NextResponse.json(body, {
    status,
    headers: { "content-type": "application/problem+json" },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Same-origin only. The session cookie is `SameSite=Lax` so a cross-site
  // POST would not carry one anyway, but there is no reason to let a third
  // party drive logins through this endpoint and watch the rate limiter.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    return problem(
      403,
      "/errors/cross-site-request",
      "Cross-site requests are not accepted.",
    );
  }

  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return problem(
      400,
      "/errors/malformed-request",
      "Request body is missing or not valid JSON",
    );
  }

  const { username, password } = body;
  if (typeof username !== "string" || typeof password !== "string") {
    return problem(400, "/errors/validation-failed", "Validation failed", {
      errors: {
        ...(typeof username !== "string" ? { username: "username is required" } : {}),
        ...(typeof password !== "string" ? { password: "password is required" } : {}),
      },
    });
  }

  try {
    const tokens = await login(username, password);

    const user: SessionUser = {
      username: tokens.username,
      roles: tokens.roles ?? [],
    };

    const response = NextResponse.json(user, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });

    writeSession(response.cookies, tokens);
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      const response = problem(
        error.status,
        error.type ?? "/errors/login-failed",
        error.message,
        error.problem?.errors ? { errors: error.problem.errors } : {},
      );
      // Let the UI tell the user how long to wait rather than guessing.
      if (error.retryAfterSeconds !== null) {
        response.headers.set(
          "retry-after",
          String(error.retryAfterSeconds),
        );
      }
      return response;
    }

    // A connection failure to the backend is the overwhelmingly likely cause
    // here, and it is worth distinguishing from "wrong password".
    console.error("Login failed before reaching the API:", error);
    return problem(
      502,
      "/errors/upstream-unreachable",
      "The payments API could not be reached. Please try again shortly.",
    );
  }
}

export function GET(): NextResponse {
  return problem(
    405,
    "/errors/method-not-allowed",
    fallbackMessageFor(405),
  );
}
