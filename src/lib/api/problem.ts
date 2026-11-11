/**
 * RFC 7807 handling.
 *
 * The backend answers every failure with `application/problem+json`, from both
 * `@RestControllerAdvice` and the filter chain, so one reader covers the lot.
 * This module is shared by server and client code and must stay free of
 * server-only imports.
 */
import type { ProblemDetail } from "@/types/api";

/** A failed API call, carrying whatever the backend was willing to say. */
export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetail | null;
  /** Backend-local problem type, e.g. `/errors/invalid-credentials`. */
  readonly type: string | null;
  /** Field-level messages from bean validation; empty unless a 400. */
  readonly fieldErrors: Record<string, string>;
  /** Seconds to wait, from `Retry-After` on a 429. */
  readonly retryAfterSeconds: number | null;

  constructor(
    status: number,
    message: string,
    options: {
      problem?: ProblemDetail | null;
      retryAfterSeconds?: number | null;
    } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.problem = options.problem ?? null;
    this.type = options.problem?.type ?? null;
    this.fieldErrors = options.problem?.errors ?? {};
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }

  /** The session is gone or was never there. */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  /** Authenticated, but not allowed to do this. */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  /** A dependency the backend needs is down; retrying is the right advice. */
  get isUnavailable(): boolean {
    return this.status === 503;
  }
}

/**
 * Fallback copy per status, used when the backend gives no `detail`.
 *
 * Written for an operator rather than a developer: each one says what happened
 * and what to do, because an error a user cannot act on is just noise.
 */
const FALLBACK_MESSAGE: Record<number, string> = {
  400: "The request was not valid. Check the highlighted fields and try again.",
  401: "Your session has ended. Please sign in again.",
  403: "You do not have permission to do this.",
  404: "We could not find what you asked for.",
  409: "That conflicts with existing data.",
  422: "The request could not be completed.",
  429: "Too many requests. Please wait a moment and try again.",
  500: "Something went wrong on the server. Please try again.",
  503: "A service this depends on is unavailable. Please retry shortly.",
};

export function fallbackMessageFor(status: number): string {
  return (
    FALLBACK_MESSAGE[status] ??
    (status >= 500
      ? "Something went wrong on the server. Please try again."
      : "The request could not be completed.")
  );
}

/** Reads a problem document, tolerating a response that is not one. */
export async function readProblem(
  response: Response,
): Promise<ProblemDetail | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (
    !contentType.includes("application/problem+json") &&
    !contentType.includes("application/json")
  ) {
    return null;
  }
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object") {
      return body as ProblemDetail;
    }
    return null;
  } catch {
    // A truncated or empty body on an error response is not itself an error
    // worth surfacing — the status code still carries the meaning.
    return null;
  }
}

function parseRetryAfter(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number.parseInt(header, 10);
  return Number.isFinite(seconds) ? seconds : null;
}

/** Turns a failed `Response` into an `ApiError`. */
export async function toApiError(response: Response): Promise<ApiError> {
  const problem = await readProblem(response);
  const message =
    problem?.detail?.trim() ||
    problem?.title?.trim() ||
    fallbackMessageFor(response.status);

  return new ApiError(response.status, message, {
    problem,
    retryAfterSeconds: parseRetryAfter(response),
  });
}

/** Normalises anything thrown by a query or mutation into a message. */
export function messageFromError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}
