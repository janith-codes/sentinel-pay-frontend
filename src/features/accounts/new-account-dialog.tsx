"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { useCreateAccount } from "@/features/accounts/use-accounts";

/**
 * Mirrors `api/dto/CreateAccountRequest.java`.
 *
 * Both fields are optional there, and `accountNumber` carries a pattern and a
 * length. Empty strings are normalised to `undefined` so an untouched field is
 * omitted from the JSON rather than sent as `""` — the backend treats an
 * absent account number as "generate an unguessable one", which is not the
 * same as being given a blank.
 */
const createAccountSchema = z.object({
  accountNumber: z
    .string()
    .trim()
    .max(50, "Account number must be at most 50 characters")
    .regex(
      /^[A-Za-z0-9-]*$/,
      "Only letters, digits and hyphens are allowed",
    )
    .optional()
    .transform((value) => (value ? value : undefined)),
  userId: z
    .union([z.literal(""), z.string().trim().uuid("Must be a valid UUID")])
    .optional()
    .transform((value) => (value ? value : undefined)),
});

type CreateAccountValues = z.input<typeof createAccountSchema>;

export function NewAccountDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const createAccount = useCreateAccount();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateAccountValues>({
    resolver: zodResolver(createAccountSchema),
    mode: "onBlur",
    defaultValues: { accountNumber: "", userId: "" },
  });

  /**
   * Opening clears whatever the last attempt left behind.
   *
   * In the handler rather than an effect on `isOpen`: the mutation object
   * takes a new identity on every status change, so an effect depending on it
   * would re-run and wipe the form mid-submission.
   */
  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) return;
    createAccount.reset();
    reset({ accountNumber: "", userId: "" });
  }

  async function onSubmit(values: CreateAccountValues) {
    try {
      const parsed = createAccountSchema.parse(values);
      const account = await createAccount.mutateAsync(parsed);
      toast.success("Account provisioned", {
        description: `${account.accountNumber} created at a zero balance.`,
      });
      setIsOpen(false);
    } catch {
      // Rendered in the dialog, beside the fields that need correcting.
    }
  }

  const error = createAccount.error;

  /** Extra guidance per failure cause. See the comment at the render site. */
  const hint = (() => {
    if (!error) return null;
    switch (error.type) {
      case "/errors/invalid-request":
        return "No identity has that id. The account can be created unlinked and linked later when the identity exists.";
      case "/errors/invalid-account-state":
        return "That identity already has an account. The link is single-valued, so replacing it would leave the previous account unreachable.";
      case "/errors/conflict":
        return "That account number is already taken. Leave the field empty to have an unguessable one generated.";
      case "/errors/access-denied":
        return "Provisioning accounts is restricted to administrators.";
      default:
        return null;
    }
  })();

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus aria-hidden="true" />
          Provision account
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Provision an account</DialogTitle>
          <DialogDescription>
            Created at a zero balance. No opening balance can be set — the
            ledger records only payments and could not account for one.
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
                {/*
                  The three ways this call fails are distinguishable by the
                  problem `type`, so each gets the advice that actually applies
                  rather than a list of everything it might have been:

                    /errors/invalid-request        userId names no identity
                    /errors/invalid-account-state  that identity already has one
                    /errors/conflict               account number is taken

                  Only the last has a generic backend message — the driver text
                  names tables and constraints, so the backend logs it rather
                  than returning it — which is exactly where the hint is worth
                  most.
                */}
                {hint ? <p className="mt-1 text-xs">{hint}</p> : null}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-account-number">
              Account number{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="new-account-number"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="ACC-0001"
              className="h-11"
              aria-invalid={errors.accountNumber ? true : undefined}
              aria-describedby={
                errors.accountNumber
                  ? "new-account-number-error"
                  : "new-account-number-hint"
              }
              {...register("accountNumber")}
            />
            {errors.accountNumber ? (
              <p
                id="new-account-number-error"
                role="alert"
                className="text-sm text-danger-700"
              >
                {errors.accountNumber.message}
              </p>
            ) : (
              <p
                id="new-account-number-hint"
                className="text-xs text-muted-foreground"
              >
                Leave empty to have an unguessable one generated. Must be
                unique.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-account-user">
              Link to identity{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="new-account-user"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="User UUID"
              className="h-11 font-mono text-xs"
              aria-invalid={errors.userId ? true : undefined}
              aria-describedby={
                errors.userId ? "new-account-user-error" : "new-account-user-hint"
              }
              {...register("userId")}
            />
            {errors.userId ? (
              <p
                id="new-account-user-error"
                role="alert"
                className="text-sm text-danger-700"
              >
                {errors.userId.message}
              </p>
            ) : (
              <p
                id="new-account-user-hint"
                className="text-xs text-muted-foreground"
              >
                An account is only reachable once a user record points at it.
                Leave empty to create it unlinked.
              </p>
            )}
          </div>

          {/*
            Stated here because it is the one thing that makes this field hard
            to use, and there is no frontend fix for it: the API exposes no
            endpoint that lists or searches identities, so an administrator has
            nowhere to look a UUID up. Inventing a user-directory call would be
            fabricating an integration.
          */}
          <p className="rounded-lg border border-info-200 bg-info-50 px-3 py-2.5 text-xs leading-relaxed text-info-700">
            <span className="font-medium">Finding a user id: </span>
            the API has no endpoint that lists or searches identities, so a
            UUID has to come from elsewhere — the <code className="font-mono">users</code> table
            or whoever created the identity. Leaving this empty creates the
            account unlinked, which is the usual path.
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={createAccount.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createAccount.isPending}>
              {createAccount.isPending ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Provisioning…
                </>
              ) : (
                "Provision account"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
