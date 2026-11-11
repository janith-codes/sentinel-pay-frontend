/**
 * `/bff/api/*` → `<backend>/api/v1/*`
 *
 * The single door between the browser and Spring Boot. All the behaviour lives
 * in `proxyToBackend`; this file only binds it to the HTTP methods the API
 * actually uses.
 */
import type { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/api/server-client";

/** Sessions are per user and nothing here may be cached or prerendered. */
export const dynamic = "force-dynamic";

/**
 * Node, not Edge: the refresh single-flight in lib/auth/token-exchange.ts
 * relies on module state surviving between requests in one process, which the
 * Edge runtime does not promise.
 */
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  const { path } = await context.params;
  return proxyToBackend(request, path ?? []);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
