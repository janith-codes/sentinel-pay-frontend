"use client";

import { Check, LogOut, Minus, ShieldCheck, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/providers/auth-provider";

/**
 * Session details, and an honest statement of what this console supports.
 *
 * The capability table is here rather than in a README because it is the
 * answer to "why can I not do X in this UI", and that question gets asked in
 * front of the screen. Every "not supported" row names the backend reason.
 */

interface Capability {
  name: string;
  supported: boolean;
  detail: string;
}

const AUTH_CAPABILITIES: Capability[] = [
  {
    name: "Password sign-in",
    supported: true,
    detail: "POST /api/v1/auth/login — returns a 15-minute access token.",
  },
  {
    name: "Silent token refresh",
    supported: true,
    detail:
      "POST /api/v1/auth/refresh — rotated and single use. Handled server-side; the browser never sees a token.",
  },
  {
    name: "Session revocation on sign-out",
    supported: true,
    detail:
      "POST /api/v1/auth/logout — revokes every access token in the session and closes the refresh family.",
  },
  {
    name: "Self-service registration",
    supported: false,
    detail:
      "The backend exposes no sign-up endpoint. Identities and accounts are provisioned administratively.",
  },
  {
    name: "Password change or reset",
    supported: false,
    detail: "No endpoint exists for either.",
  },
];

const PLATFORM_CAPABILITIES: Capability[] = [
  {
    name: "Submit a payment",
    supported: true,
    detail:
      "POST /api/v1/payments, with a client-supplied Idempotency-Key so a retry cannot take it twice.",
  },
  {
    name: "Search payment history",
    supported: true,
    detail:
      "GET /api/v1/payments — filter, order and page, all executed in the database.",
  },
  {
    name: "Read a single payment",
    supported: true,
    detail: "GET /api/v1/payments/{id}.",
  },
  {
    name: "Dashboard aggregation",
    supported: true,
    detail:
      "GET /api/v1/admin/dashboard/* — ADMIN only. An account holder has no aggregate endpoint, so their overview is assembled from paged counts.",
  },
  {
    name: "Provision an account",
    supported: true,
    detail: "POST /api/v1/accounts — ADMIN only, at a zero balance.",
  },
  {
    name: "Outbox triage and re-drive",
    supported: true,
    detail: "GET and POST /api/v1/admin/outbox/* — ADMIN only.",
  },
  {
    name: "Adjust a balance",
    supported: false,
    detail:
      "Deliberately absent from the backend. A payment is the only thing that moves money, and it is recorded in the ledger; an endpoint that set a balance directly would leave the ledger unable to explain it.",
  },
  {
    name: "Suspend, freeze or close an account",
    supported: false,
    detail:
      "The account statuses exist in the domain model, but no endpoint transitions them.",
  },
  {
    name: "Refund or reverse a payment",
    supported: false,
    detail: "No endpoint exists. A transaction is append-only.",
  },
  {
    name: "Platform revenue",
    supported: false,
    detail:
      "Cannot be derived. A transaction records only its amount — there is no fee, commission, spread or platform share anywhere in the payment model. The volume figures are money that moved, not revenue.",
  },
];

function CapabilityList({ items }: { items: Capability[] }) {
  return (
    <ul className="flex flex-col">
      {items.map((capability, index) => (
        <li key={capability.name}>
          {index > 0 ? <Separator /> : null}
          <div className="flex items-start gap-3 py-3">
            <span
              className={
                capability.supported
                  ? "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success-50 text-success-700"
                  : "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-500"
              }
            >
              {capability.supported ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                <Minus className="size-3.5" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {capability.name}
                {/* The state is in text, not conveyed by the icon's colour
                    alone. */}
                <span className="visually-hidden">
                  {capability.supported ? " — supported" : " — not available"}
                </span>
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {capability.detail}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SettingsView() {
  const { user, isAdmin, signOut, isSigningOut } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Session</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-navy-100 text-sm font-semibold text-navy-800">
              {user.username.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="font-medium">{user.username}</p>
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {user.roles.map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-1.5 py-0.5 font-medium text-navy-700"
                  >
                    {role === "ADMIN" ? (
                      <ShieldCheck className="size-3" aria-hidden="true" />
                    ) : (
                      <User className="size-3" aria-hidden="true" />
                    )}
                    {role}
                  </span>
                ))}
                <span>
                  {isAdmin
                    ? "— may read and act on every account"
                    : "— confined to the account linked to this identity"}
                </span>
              </p>
            </div>
          </div>

          <Separator />

          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              How this session is held
            </p>
            <p className="mt-1 leading-relaxed">
              The access and refresh tokens are kept in httpOnly cookies on the
              Next.js server and attached to each request there. Page scripts
              cannot read them, so a cross-site scripting flaw anywhere in this
              app cannot exfiltrate the session. The cost is an extra hop for
              every API call, and a CSRF surface that bearer headers do not
              have — answered with <code className="font-mono text-xs">SameSite=Lax</code>{" "}
              cookies and an origin check on every mutating request.
            </p>
          </div>

          <div>
            <Button
              variant="destructive"
              onClick={() => void signOut()}
              disabled={isSigningOut}
            >
              <LogOut aria-hidden="true" />
              {isSigningOut ? "Signing out…" : "Sign out"}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Revokes every access token in this session and closes the refresh
              family, so no new pair can be issued.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Authentication</CardTitle>
        </CardHeader>
        <CardContent>
          <CapabilityList items={AUTH_CAPABILITIES} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Platform capabilities</CardTitle>
        </CardHeader>
        <CardContent>
          <CapabilityList items={PLATFORM_CAPABILITIES} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Rate limits</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p className="leading-relaxed">
            The backend enforces per-caller limits in Redis, so they hold across
            instances rather than once per instance: 10 sign-ins and 20 refreshes
            a minute, 60 payments, 120 administrative calls and 300 others.
            Limiting happens after authentication, so a signed-in caller is
            counted by user id rather than by address — one noisy client cannot
            spend the budget of everyone behind the same NAT, and changing
            address does not reset it.
          </p>
          <p className="mt-3 leading-relaxed">
            This console does not retry a request the backend answered{" "}
            <code className="font-mono text-xs">429</code>, and does not retry
            any 4xx: automatic retries are how a rate limit becomes a lockout.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
