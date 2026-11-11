"use client";

import { useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/problem";
import { loginRequest } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { loginSchema, type LoginValues } from "@/features/auth/login-schema";

/** Where to go after signing in when the URL asks for nowhere in particular. */
const DEFAULT_DESTINATION = "/dashboard";

/**
 * Only same-site paths are honoured.
 *
 * `next` comes from the query string, so it is attacker-controlled. Without
 * this check a crafted link could bounce a freshly authenticated user to
 * another origin, which is the classic post-login open redirect.
 */
function safeDestination(next: string | null): string {
  if (!next) return DEFAULT_DESTINATION;
  // Must be a single-slash absolute path. `//evil.com` is protocol-relative
  // and would leave the site; `\\evil.com` is normalised the same way by some
  // browsers.
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return DEFAULT_DESTINATION;
  }
  return next;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const errorId = useId();
  const usernameHintId = useId();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    // Validate when a field is left, not while typing: warning someone their
    // password is too short before they have finished entering it is noise.
    mode: "onBlur",
    defaultValues: { username: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setFormError(null);

    try {
      await loginRequest(values.username, values.password);

      // A full navigation rather than `router.push`: the dashboard layout is a
      // server component that reads the new session cookie, and it has to be
      // re-rendered on the server for the sign-in to take effect.
      const destination = safeDestination(searchParams.get("next"));
      router.replace(destination);
      router.refresh();
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setFormError(
          "Could not reach the sign-in service. Check your connection and try again.",
        );
        return;
      }

      // Field-level messages from the backend's bean validation, attached to
      // the fields they belong to.
      const fieldErrors = Object.entries(error.fieldErrors);
      if (fieldErrors.length > 0) {
        for (const [field, message] of fieldErrors) {
          if (field === "username" || field === "password") {
            setError(field, { type: "server", message });
          }
        }
        if (fieldErrors.every(([f]) => f === "username" || f === "password")) {
          return;
        }
      }

      if (error.isRateLimited) {
        // The backend allows 10 login attempts a minute per client and sends
        // `Retry-After`, so the user can be told how long rather than guessing.
        const wait = error.retryAfterSeconds;
        setFormError(
          wait
            ? `Too many sign-in attempts. Try again in ${wait} second${wait === 1 ? "" : "s"}.`
            : "Too many sign-in attempts. Please wait a moment and try again.",
        );
        return;
      }

      if (error.isUnauthenticated) {
        // Deliberately does not say which half was wrong — the backend returns
        // one message for both, and narrowing it here would hand an attacker a
        // way to confirm valid usernames.
        setFormError("That username and password combination is not correct.");
        return;
      }

      setFormError(error.message);
    }
  }

  const hasFieldErrors = Boolean(errors.username || errors.password);

  return (
    // `noValidate` hands validation to Zod, so the messages are ours and
    // consistent rather than the browser's per-locale bubbles.
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {/* `assertive`: a failed sign-in must be announced immediately, since
          nothing else on screen changes to signal it. */}
      {formError ? (
        <div
          id={errorId}
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-2.5 rounded-lg border border-danger-200 bg-danger-50 px-3.5 py-3 text-sm text-danger-700"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{formError}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          type="text"
          // The backend authenticates on a username, so autofill is told that
          // rather than `email`, which would offer the wrong saved value.
          autoComplete="username"
          // An identifier, not prose: correcting or capitalising it would
          // silently change what the user typed.
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="next"
          autoFocus
          aria-invalid={errors.username ? true : undefined}
          aria-describedby={cn(
            errors.username ? `${usernameHintId}-error` : usernameHintId,
          )}
          className="h-11"
          {...register("username")}
        />
        {errors.username ? (
          <p
            id={`${usernameHintId}-error`}
            className="text-sm text-danger-700"
            role="alert"
          >
            {errors.username.message}
          </p>
        ) : (
          <p id={usernameHintId} className="text-xs text-muted-foreground">
            The username your administrator issued, not an email address.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            enterKeyHint="done"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "password-error" : undefined}
            className="h-11 pr-11"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            // The state is in the label rather than only in the icon, so it is
            // announced as well as shown.
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {errors.password ? (
          <p id="password-error" className="text-sm text-danger-700" role="alert">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      {/*
        Disabled only while a submission is in flight, never to gate
        validation. Blocking the button until the form is valid hides the
        reason it is blocked; letting the submit through and showing the errors
        is both clearer and reachable by keyboard.
      */}
      <Button
        type="submit"
        size="lg"
        className="h-11 w-full"
        disabled={isSubmitting}
        aria-describedby={formError ? errorId : undefined}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            Signing in…
          </>
        ) : (
          <>
            <LogIn aria-hidden="true" />
            Sign in
          </>
        )}
      </Button>

      {hasFieldErrors && !formError ? (
        <p className="visually-hidden" role="status">
          The form has errors. Review the highlighted fields.
        </p>
      ) : null}
    </form>
  );
}
