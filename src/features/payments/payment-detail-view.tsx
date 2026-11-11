"use client";

import Link from "next/link";
import { ArrowLeft, FileQuestion, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CopyableId } from "@/components/shared/copyable-id";
import { PageHeader } from "@/components/shared/page-header";
import { CapabilityNote, ErrorState } from "@/components/shared/states";
import {
  PaymentStatusBadge,
  RiskScoreBadge,
} from "@/components/shared/status-badge";
import { usePayment } from "@/features/payments/use-payments";
import { messageFromError } from "@/lib/api/problem";
import {
  formatAmount,
  formatDateTime,
  formatRelative,
} from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

/**
 * One payment, at its own URL.
 *
 * ---------------------------------------------------------------------------
 * On the "not found" case
 * ---------------------------------------------------------------------------
 * `PaymentQueryService.getPayment` throws `PaymentNotFoundException` both when
 * no such payment exists *and* when it belongs to an account the caller may not
 * read. That is deliberate: answering 403 for the second case would confirm the
 * id is real, which is the whole of an enumeration attack.
 *
 * So this screen cannot tell the two apart, and it does not pretend to. The
 * copy covers both without implying the payment exists.
 */

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="shrink-0 text-sm font-medium text-muted-foreground">
        {label}
        {hint ? (
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground/80">
            {hint}
          </span>
        ) : null}
      </dt>
      {/*
        `pr-1` absorbs the 4px that the copy button's hit-area margin bleeds
        past its text. Without it every row's content sits 4px wider than the
        list that contains it, which shows up as a ragged right edge against
        the `divide-y` rules.
      */}
      <dd className="min-w-0 pr-1 text-sm sm:text-right">{children}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-2" aria-hidden="true">
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      </div>
      <Card>
        <CardContent className="flex flex-col gap-4 py-6" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="flex items-center justify-between gap-6">
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
              <div className="h-4 w-44 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </CardContent>
      </Card>
      <span className="visually-hidden" role="status">
        Loading payment
      </span>
    </>
  );
}

export function PaymentDetailView({
  paymentId,
  /** Query string of the list this was opened from, so Back returns to it. */
  backSearch,
}: {
  paymentId: string;
  backSearch?: string;
}) {
  const { isAdmin } = useAuth();
  const payment = usePayment(paymentId);

  const backHref = backSearch ? `/payments?${backSearch}` : "/payments";

  const backLink = (
    <Button variant="ghost" size="sm" asChild>
      <Link href={backHref}>
        <ArrowLeft aria-hidden="true" />
        Back to payments
      </Link>
    </Button>
  );

  if (payment.isLoading) {
    return (
      <>
        {backLink}
        <DetailSkeleton />
      </>
    );
  }

  // 404 covers both "no such payment" and "not yours". See the note above.
  if (payment.isNotFound) {
    return (
      <>
        {backLink}
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <FileQuestion className="size-8 text-ink-300" aria-hidden="true" />
            <p className="font-medium">No such payment</p>
            <p className="max-w-md text-sm text-muted-foreground">
              There is no payment with this id that you can read. It may never
              have existed, or it may belong to another account — the API
              answers the same way to both, so that payment ids cannot be
              discovered by guessing.
            </p>
            <code className="mt-1 font-mono text-xs break-all text-muted-foreground">
              {paymentId}
            </code>
            <Button variant="outline" size="sm" className="mt-2" asChild>
              <Link href={backHref}>Back to payments</Link>
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  // A USER does reach 403 on the history endpoint when they name another
  // account explicitly, so the state is handled here too rather than assumed
  // impossible.
  if (payment.isForbidden) {
    return (
      <>
        {backLink}
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldAlert className="size-8 text-ink-300" aria-hidden="true" />
            <p className="font-medium">Not yours to read</p>
            <p className="max-w-md text-sm text-muted-foreground">
              This payment belongs to an account your role may not read.
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  if (payment.isError || !payment.data) {
    return (
      <>
        {backLink}
        <ErrorState
          message={messageFromError(payment.error)}
          onRetry={() => void payment.refetch()}
        />
      </>
    );
  }

  const data = payment.data;

  return (
    <>
      {backLink}

      <PageHeader
        title={formatAmount(data.amount, data.currency)}
        description={`Submitted ${formatRelative(data.createdAt)}`}
        actions={<PaymentStatusBadge status={data.status} />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Payment</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col divide-y">
            <Field label="Payment ID">
              <CopyableId value={data.paymentId} label="payment id" />
            </Field>

            <Field label="Account">
              {/*
                Linked only for an ADMIN. A USER may read their own account, so
                the link would work — but every payment they can see is on that
                one account, making it a link to where they already are.
              */}
              {isAdmin ? (
                <span className="inline-flex items-center gap-2">
                  <CopyableId value={data.accountId} label="account id" />
                  <Link
                    href={`/payments?accountId=${encodeURIComponent(data.accountId)}`}
                    className="text-xs text-primary underline-offset-4 hover:underline"
                  >
                    View payments
                  </Link>
                </span>
              ) : (
                <CopyableId value={data.accountId} label="account id" />
              )}
            </Field>

            <Field label="Amount">
              <span className="numeric font-medium">
                {formatAmount(data.amount, data.currency)}
              </span>
            </Field>

            <Field label="Currency">
              <span className="font-mono text-xs">{data.currency}</span>
            </Field>

            <Field label="Status">
              <PaymentStatusBadge status={data.status} />
            </Field>

            <Field
              label="Reference"
              hint="The idempotency key it was submitted with"
            >
              {data.reference ? (
                <code className="font-mono text-xs break-all">
                  {data.reference}
                </code>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col divide-y">
            <Field label="Accepted for processing">
              <time dateTime={data.createdAt} className="numeric">
                {formatDateTime(data.createdAt)}
              </time>
            </Field>

            <Field label="Processing finished">
              {data.processedAt ? (
                <time dateTime={data.processedAt} className="numeric">
                  {formatDateTime(data.processedAt)}
                </time>
              ) : (
                <span className="text-muted-foreground">
                  Still pending
                </span>
              )}
            </Field>
          </dl>
        </CardContent>
      </Card>

      {/*
        Fraud information is rendered only for an ADMIN, because the backend
        only sends it to one: `PaymentDetailResponse.forCaller` nulls
        `riskScore` unless the caller can access all accounts, so the fraud
        thresholds cannot be mapped by submitting payments and reading back the
        scores. Rendering the panel for a USER would be a panel of dashes.
      */}
      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Fraud assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col divide-y">
              <Field label="Risk score" hint="0–100, administrators only">
                <RiskScoreBadge score={data.riskScore} />
              </Field>
            </dl>

            {data.riskScore === null ? (
              <>
                <Separator className="my-3" />
                <p className="text-xs text-muted-foreground">
                  No score is recorded against this payment.
                </p>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <CapabilityNote>
          The fraud risk score is returned to administrators only. The backend
          withholds it from an account holder so that the fraud thresholds
          cannot be probed by submitting payments and reading back the scores.
        </CapabilityNote>
      )}

      <CapabilityNote>
        <span className="font-medium">A payment cannot be changed. </span>
        The backend exposes no endpoint to refund, reverse, retry or cancel a
        transaction — the ledger is append-only, and a correction would have to
        be a new payment recorded in its own right.
      </CapabilityNote>
    </>
  );
}
