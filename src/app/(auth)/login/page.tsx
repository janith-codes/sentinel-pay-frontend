import { Suspense } from "react";
import type { Metadata } from "next";
import { Lock, ShieldCheck, Zap } from "lucide-react";

import { Brand } from "@/components/layout/brand";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

/** The three points worth making on a payments console sign-in screen. */
const ASSURANCES = [
  {
    Icon: Lock,
    title: "Tokens never reach the browser",
    body: "Access and refresh tokens are held in httpOnly cookies on the server, so page scripts cannot read them.",
  },
  {
    Icon: ShieldCheck,
    title: "Short-lived credentials",
    body: "Access tokens last 15 minutes and are checked against a revocation store on every request.",
  },
  {
    Icon: Zap,
    title: "Rotating refresh tokens",
    body: "Each refresh token is single use. Replaying a spent one is treated as a compromise and closes the session.",
  },
];

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_minmax(28rem,38%)]">
      {/* ----------------------------------------------------------------
          Brand panel. Hidden below `lg` rather than stacked above the form:
          on a phone the form should be the first thing in reach, not below
          a screenful of marketing.
      ---------------------------------------------------------------- */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-navy-950 p-10 text-navy-100 lg:flex">
        {/* Decorative wash. `aria-hidden` because it carries no information. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(60rem 40rem at 15% 10%, #1f3561 0%, transparent 60%), radial-gradient(45rem 35rem at 85% 85%, #2d487c 0%, transparent 55%)",
          }}
        />

        <div className="relative">
          <Brand className="text-navy-100" />
        </div>

        <div className="relative max-w-xl">
          <h2 className="text-3xl font-semibold tracking-tight text-white">
            Payment processing, with the ledger as the source of truth.
          </h2>
          <p className="mt-3 text-navy-200">
            Every figure in this console is aggregated from persisted
            transactions. Nothing is cached, and nothing is estimated.
          </p>

          <ul className="mt-10 flex flex-col gap-5">
            {ASSURANCES.map(({ Icon, title, body }) => (
              <li key={title} className="flex items-start gap-3.5">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-navy-800/80 text-navy-200">
                  <Icon className="size-4.5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-white">{title}</p>
                  <p className="mt-0.5 text-sm text-navy-200/90">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-navy-300/70">
          SentinelPay — AI-driven fraud detection and payment gateway.
        </p>
      </section>

      {/* ----------------------------------------------------------------
          Form panel
      ---------------------------------------------------------------- */}
      <main className="flex flex-col justify-center bg-card px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="lg:hidden">
            <Brand />
          </div>

          <div className="mt-8 lg:mt-0">
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Enter your credentials to reach the payments console.
            </p>
          </div>

          <div className="mt-8">
            {/*
              `useSearchParams` in the form reads the `next` parameter, which
              makes it a dynamic read; the Suspense boundary is what keeps that
              from opting the whole route out of static rendering.
            */}
            <Suspense
              fallback={
                <div
                  className="h-64 animate-pulse rounded-[--radius-card] bg-muted"
                  aria-hidden="true"
                />
              }
            >
              <LoginForm />
            </Suspense>
          </div>

          <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
            Accounts are provisioned by an administrator. There is no
            self-service registration flow — the backend exposes no sign-up
            endpoint, and an account is only reachable once an identity record
            points at it.
          </p>
        </div>
      </main>
    </div>
  );
}
