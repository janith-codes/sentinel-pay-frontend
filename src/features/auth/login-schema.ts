import { z } from "zod";

/**
 * Mirrors `api/dto/LoginRequest.java`.
 *
 * The field is `username`, not `email`. The backend's `LoginRequest` declares
 * `@NotBlank @Size(max = 100) String username` with no `@Email` constraint,
 * the users table has no email column, and `UserRepositoryPort` looks identities
 * up by username. Presenting this as an email field — and validating it as one
 * — would reject credentials the backend accepts, so the field matches the
 * contract rather than the mock-up.
 *
 * The length limits are the backend's own, so an over-long value is refused
 * here rather than spending a request and a slice of the login rate limit
 * (10 attempts per minute) to be told the same thing.
 */
export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Enter your username")
    .max(100, "Username must be at most 100 characters"),
  password: z
    .string()
    .min(1, "Enter your password")
    .max(200, "Password must be at most 200 characters"),
});

export type LoginValues = z.infer<typeof loginSchema>;
