"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreatePayment } from "@/features/payments/use-payments";
import {
  paymentSchema,
  type PaymentValues,
} from "@/features/payments/payment-schema";
import { newIdempotencyKey } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import type { Account } from "@/types/api";

/**
 * Submits a payment.
 *
 * ---------------------------------------------------------------------------
 * Idempotency
 * ---------------------------------------------------------------------------
 * A key is generated when the dialog opens and reused for every retry of that
 * submission, which is what makes the retry button safe: the backend stores the
 * result against the key in Redis and returns the original outcome rather than
 * taking the money again. The key is regenerated only when the dialog is
 * reopened, because that is a genuinely new payment.
 *
 * Leaving the header off would be worse than useless here — the backend
 * generates its own key when it is absent, so every retry would look like a
 * fresh payment and a double-click could charge twice.
 */
export function NewPaymentDialog({
  account,
}: {
  /** The USER's own account, pre-filled. Absent for an ADMIN, who must name one. */
  account?: Account;
}) {
  const { isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const createPayment = useCreatePayment();

  /**
   * One key per opening of the dialog, so retries reuse it.
   *
   * State rather than a ref, because the key is rendered — a ref read during
   * render is not guaranteed to be the value the user is shown. Generated in
   * the effect below rather than in the initial state, so no random value is
   * produced during server rendering for the client to disagree with.
   */
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    mode: "onBlur",
    defaultValues: {
      accountId: account?.accountId ?? "",
      amount: "",
      currency: "LKR",
    },
  });

  /**
   * Opening the dialog starts a new payment, so it gets a new key.
   *
   * Done here rather than in an effect on `isOpen`: opening is an event, and
   * deriving it from state afterwards would mean a render with the old key
   * followed by a second one with the new, plus an effect whose dependency
   * list has to be exactly right or the key changes mid-submission — which is
   * the one bug this whole mechanism exists to prevent.
   */
  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) return;

    setIdempotencyKey(newIdempotencyKey());
    createPayment.reset();
    reset({
      accountId: account?.accountId ?? "",
      amount: "",
      currency: "LKR",
    });
  }

  // The account is fetched asynchronously, so it can arrive after the dialog
  // was opened. `setValue` rather than `reset`, to leave anything already
  // typed alone.
  useEffect(() => {
    if (account?.accountId) setValue("accountId", account.accountId);
  }, [account?.accountId, setValue]);

  async function onSubmit(values: PaymentValues) {
    // The effect above sets this when the dialog opens, so it is only ever
    // null if a submission somehow beat the effect. Minting one here keeps the
    // request idempotent either way.
    const key = idempotencyKey ?? newIdempotencyKey();
    if (!idempotencyKey) setIdempotencyKey(key);

    try {
      const result = await createPayment.mutateAsync({
        body: {
          accountId: values.accountId,
          amount: values.amount,
          currency: values.currency,
        },
        idempotencyKey: key,
      });

      // 201 only ever carries COMPLETED. Any other status arriving on a
      // successful response is still worth reporting faithfully rather than
      // announcing a success that did not happen.
      if (result.status === "COMPLETED") {
        toast.success("Payment completed", {
          description: result.message ?? `Transaction ${result.transactionId}`,
        });
        setIsOpen(false);
      } else {
        toast.warning(`Payment ${result.status.toLowerCase()}`, {
          description: result.message ?? undefined,
        });
      }
    } catch {
      // `createPayment.error` renders inside the dialog, which keeps the
      // message beside the form the user has to correct.
    }
  }

  const error = createPayment.error;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus aria-hidden="true" />
          New payment
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New payment</DialogTitle>
          <DialogDescription>
            {isAdmin
              ? "An administrator may transact on any account."
              : "Payments can only be taken from your own account."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
        >
          {error ? (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-2.5 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2.5 text-sm text-danger-700"
            >
              <AlertCircle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <div>
                <p>{error.message}</p>
                {/* A 422 from an insufficient balance is a business outcome,
                    not a malfunction, and is worth naming as such. */}
                {error.type === "/errors/insufficient-balance" ? (
                  <p className="mt-1 text-xs">
                    The account balance does not cover this amount.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-account">Account</Label>
            <Input
              id="payment-account"
              // An administrator may transact on any account, so the field is
              // editable for them and fixed for an account holder — which
              // mirrors `AuthenticatedUser.canTransactOn`.
              readOnly={!isAdmin && Boolean(account?.accountId)}
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Account UUID"
              className="h-11 font-mono text-xs"
              aria-invalid={errors.accountId ? true : undefined}
              aria-describedby={
                errors.accountId ? "payment-account-error" : undefined
              }
              {...register("accountId")}
            />
            {errors.accountId ? (
              <p
                id="payment-account-error"
                role="alert"
                className="text-sm text-danger-700"
              >
                {errors.accountId.message}
              </p>
            ) : account ? (
              <p className="text-xs text-muted-foreground">
                {account.accountNumber} · balance {account.balance}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payment-amount">Amount</Label>
              <Input
                id="payment-amount"
                // `text` with a numeric inputmode, not `type="number"`: a
                // number input strips leading zeros, scrolls the value on a
                // stray wheel event, and varies by locale on the decimal
                // separator. None of that is acceptable for money.
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                className="numeric h-11"
                aria-invalid={errors.amount ? true : undefined}
                aria-describedby={
                  errors.amount ? "payment-amount-error" : undefined
                }
                {...register("amount")}
              />
              {errors.amount ? (
                <p
                  id="payment-amount-error"
                  role="alert"
                  className="text-sm text-danger-700"
                >
                  {errors.amount.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payment-currency">Currency</Label>
              <Input
                id="payment-currency"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={3}
                placeholder="LKR"
                className="h-11 uppercase"
                aria-invalid={errors.currency ? true : undefined}
                aria-describedby={
                  errors.currency ? "payment-currency-error" : undefined
                }
                {...register("currency")}
              />
              {errors.currency ? (
                <p
                  id="payment-currency-error"
                  role="alert"
                  className="text-sm text-danger-700"
                >
                  {errors.currency.message}
                </p>
              ) : null}
            </div>
          </div>

          {idempotencyKey ? (
            <p className="text-xs text-muted-foreground">
              Submitted with idempotency key{" "}
              <code className="font-mono text-[0.7rem]">
                {idempotencyKey.slice(0, 8)}…
              </code>
              , so retrying this submission cannot take the payment twice.
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={createPayment.isPending}
            >
              Cancel
            </Button>
            {/* Disabled while in flight, to stop a double-post — never to gate
                validation, which would hide why it is blocked. */}
            <Button type="submit" disabled={createPayment.isPending}>
              {createPayment.isPending ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Submitting…
                </>
              ) : (
                "Submit payment"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
