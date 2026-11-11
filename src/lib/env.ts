/**
 * Server-side configuration.
 *
 * Importing this from a client component is a build error by design — it is
 * marked `server-only`. Nothing here may leak into the browser bundle: the API
 * host is deliberately not a `NEXT_PUBLIC_` value, because the browser has no
 * business knowing where Spring Boot lives.
 */
import "server-only";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Copy .env.example to .env.local and set it.`,
    );
  }
  return value;
}

/** Base URL of the Spring Boot API as seen from this Next.js server. */
export const API_BASE_URL = required(
  "SENTINELPAY_API_BASE_URL",
  "http://localhost:8080",
).replace(/\/+$/, "");

/**
 * Whether session cookies carry the `Secure` attribute.
 *
 * On in production unless explicitly disabled, so a production deployment
 * cannot accidentally ship cookies that travel over plain HTTP. Off in
 * development, where the dev server is HTTP and a `Secure` cookie would simply
 * never be stored.
 */
export const COOKIE_SECURE =
  process.env.SENTINELPAY_COOKIE_SECURE === "true" ||
  (process.env.NODE_ENV === "production" &&
    process.env.SENTINELPAY_COOKIE_SECURE !== "false");

export const API_PREFIX = "/api/v1";
