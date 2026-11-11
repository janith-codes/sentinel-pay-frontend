import { z } from "zod";

/**
 * Mirrors `api/dto/PaymentRequest.java`.
 *
 * Validation here is the backend's own constraints restated, so a value it
 * would refuse is caught before a request is spent on it — the payment
 * endpoint allows 60 calls a minute. It is not a substitute for the backend's
 * checks, which remain the only ones that matter.
 */

/** `@Digits(integer = 15, fraction = 4)` on the backend. */
const AMOUNT_PATTERN = /^\d{1,15}(\.\d{1,4})?$/;

export const paymentSchema = z.object({
  accountId: z
    .string()
    .trim()
    .min(1, "Account is required")
    .uuid("Account must be a valid UUID"),

  /**
   * Kept as a string throughout.
   *
   * `BigDecimal` on the backend, and a decimal that goes through a JavaScript
   * number comes back subtly altered — 0.1 + 0.2 is the classic, but the real
   * risk here is an amount above 2^53 silently losing its last digits. The
   * string is validated by pattern and handed to the API untouched.
   */
  amount: z
    .string()
    .trim()
    .min(1, "Amount is required")
    .regex(
      AMOUNT_PATTERN,
      "Enter an amount with up to 15 digits and 4 decimal places",
    )
    // `@DecimalMin("0.01")`. Comparison on a parsed value is safe at this
    // magnitude; the string itself is still what gets sent.
    .refine((value) => Number(value) >= 0.01, "Amount must be at least 0.01"),

  currency: z
    .string()
    .trim()
    .toUpperCase()
    .length(3, "Currency must be a 3-letter ISO code")
    .regex(/^[A-Z]{3}$/, "Currency must be three letters, for example LKR"),
});

export type PaymentValues = z.infer<typeof paymentSchema>;
