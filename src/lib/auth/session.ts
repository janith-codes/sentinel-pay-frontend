/**
 * Session storage.
 *
 * ---------------------------------------------------------------------------
 * Why cookies and not localStorage
 * ---------------------------------------------------------------------------
 * The backend issues a 15-minute JWT access token and a 30-day opaque refresh
 * token. Neither is ever handed to client JavaScript. Both live in httpOnly
 * cookies written by this Next.js server, and requests from the browser go to
 * this server, which attaches the access token and forwards them upstream.
 *
 * The alternative — returning the tokens to the browser and keeping them in
 * `localStorage` — makes any XSS anywhere in the app a complete session theft,
 * and a 30-day refresh token in `localStorage` is a 30-day account compromise.
 * An httpOnly cookie is not readable by injected script, so XSS is reduced
 * from "exfiltrate the session" to "act inside the current page".
 *
 * ---------------------------------------------------------------------------
 * The trade-offs this buys, stated plainly
 * ---------------------------------------------------------------------------
 *  - Cookies are sent by the browser automatically, which is a CSRF surface
 *    that bearer headers do not have. Mitigated two ways: `SameSite=Lax`,
 *    which stops the cookie riding along on any cross-site POST, and an
 *    explicit `Origin` check on every mutating proxy request.
 *  - Every API call takes an extra network hop through this server. That is
 *    the cost of the browser never holding a credential.
 *  - `sp_user` holds the identity (username, roles) used to decide which
 *    navigation to render. It is httpOnly so page script cannot read or edit
 *    it, but it is still only a UI hint: every authorisation decision is made
 *    by the backend against the signed JWT. Forging this cookie buys a
 *    misleading menu and nothing else.
 */
import "server-only";

import { cookies } from "next/headers";

import { COOKIE_SECURE } from "@/lib/env";
import type { AuthTokens, Role, SessionUser } from "@/types/api";

export const ACCESS_TOKEN_COOKIE = "sp_at";
export const REFRESH_TOKEN_COOKIE = "sp_rt";
export const USER_COOKIE = "sp_user";

export interface SessionCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge: number;
}

/**
 * A cookie jar we can write to.
 *
 * Declared structurally rather than imported from Next's internals, so this
 * accepts both the jar from `cookies()` in a route handler and the one hanging
 * off a `NextResponse`, which is what the proxy actually writes to.
 */
export interface CookieWriter {
  set(name: string, value: string, options: SessionCookieOptions): unknown;
}

const BASE_COOKIE = {
  httpOnly: true,
  secure: COOKIE_SECURE,
  // `lax`, not `strict`: `strict` would drop the cookie when a user arrives
  // from an external link, logging them out for no security gain here. `lax`
  // still withholds it from cross-site POSTs, which is the CSRF case.
  sameSite: "lax" as const,
  path: "/",
};

/**
 * Writes an access/refresh pair plus identity into cookies.
 *
 * Cookie lifetimes mirror the token lifetimes the backend reported, so the
 * access cookie simply disappears when the token expires. The proxy treats
 * "access cookie absent, refresh cookie present" as "refresh before calling",
 * which is how a 15-minute token stays invisible to the user.
 */
export function writeSession(jar: CookieWriter, tokens: AuthTokens): void {
  jar.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...BASE_COOKIE,
    maxAge: tokens.expiresIn,
  });

  jar.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...BASE_COOKIE,
    maxAge: tokens.refreshExpiresIn,
  });

  const user: SessionUser = {
    username: tokens.username,
    roles: tokens.roles ?? [],
  };

  jar.set(USER_COOKIE, JSON.stringify(user), {
    ...BASE_COOKIE,
    maxAge: tokens.refreshExpiresIn,
  });
}

/** Removes every session cookie. Used on logout and on a dead session. */
export function clearSession(jar: CookieWriter): void {
  for (const name of [
    ACCESS_TOKEN_COOKIE,
    REFRESH_TOKEN_COOKIE,
    USER_COOKIE,
  ]) {
    // `delete` alone can miss when attributes differ, so overwrite with an
    // immediately-expiring value as well.
    jar.set(name, "", { ...BASE_COOKIE, maxAge: 0 });
  }
}

function isRole(value: unknown): value is Role {
  return value === "USER" || value === "ADMIN";
}

/** Parses the identity cookie. Returns null rather than throwing on junk. */
export function parseSessionUser(raw: string | undefined): SessionUser | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as { username?: unknown }).username !== "string"
    ) {
      return null;
    }
    const candidate = parsed as { username: string; roles?: unknown };
    const roles = Array.isArray(candidate.roles)
      ? candidate.roles.filter(isRole)
      : [];
    return { username: candidate.username, roles };
  } catch {
    return null;
  }
}

/**
 * The current user, for server components.
 *
 * Reports a session whenever a refresh token is present: the access token may
 * well have expired, and that is recoverable without involving the user.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  if (!jar.get(REFRESH_TOKEN_COOKIE)?.value) return null;
  return parseSessionUser(jar.get(USER_COOKIE)?.value);
}

export function hasRole(user: SessionUser | null, role: Role): boolean {
  return user?.roles.includes(role) ?? false;
}

export function isAdmin(user: SessionUser | null): boolean {
  return hasRole(user, "ADMIN");
}
