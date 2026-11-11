/**
 * Transcription of the Spring Boot API contract.
 *
 * Every type here mirrors a Java record in the backend. The mapping is given
 * per block so the two can be diffed by hand when the backend changes. Nothing
 * in this file is invented: a field that does not exist in the backend DTO
 * does not exist here either.
 *
 * `BigDecimal` and `Instant` both serialise to JSON strings by default in this
 * backend's Jackson configuration, so they are typed as `string` rather than
 * `number`/`Date`. Amounts in particular must stay strings end to end — a
 * ledger value put through an IEEE-754 double is a ledger value you can no
 * longer trust.
 */

// ---------------------------------------------------------------------------
// Enums — domain/model/TransactionStatus.java, AccountStatus.java,
//         identity/Role.java, application/dto/*SortField.java, OutboxEventStatus
// ---------------------------------------------------------------------------

export const TRANSACTION_STATUSES = [
  "PENDING",
  "COMPLETED",
  "REJECTED",
  "FAILED",
] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const ACCOUNT_STATUSES = [
  "ACTIVE",
  "SUSPENDED",
  "CLOSED",
  "FROZEN",
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ROLES = ["USER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const PAYMENT_SORT_FIELDS = [
  "CREATED_AT",
  "PROCESSED_AT",
  "AMOUNT",
  "STATUS",
] as const;
export type PaymentSortField = (typeof PAYMENT_SORT_FIELDS)[number];

export const ACCOUNT_SORT_FIELDS = [
  "CREATED_AT",
  "ACCOUNT_NUMBER",
  "BALANCE",
  "STATUS",
] as const;
export type AccountSortField = (typeof ACCOUNT_SORT_FIELDS)[number];

export const OUTBOX_SORT_FIELDS = [
  "FAILED_AT",
  "CREATED_AT",
  "ATTEMPTS",
  "REDRIVE_COUNT",
] as const;
export type OutboxSortField = (typeof OUTBOX_SORT_FIELDS)[number];

export const OUTBOX_EVENT_STATUSES = ["PENDING", "PUBLISHED", "FAILED"] as const;
export type OutboxEventStatus = (typeof OUTBOX_EVENT_STATUSES)[number];

export type SortDirection = "ASC" | "DESC";

/** application/dto/PageQuery.java — MAX_SIZE. The backend rejects anything above. */
export const PAGE_MAX_SIZE = 100;
export const PAGE_DEFAULT_SIZE = 20;

// ---------------------------------------------------------------------------
// Authentication — application/dto/AuthTokens.java
// ---------------------------------------------------------------------------

/**
 * What POST /api/v1/auth/login and /refresh return.
 *
 * This shape never reaches the browser: the Next.js server consumes it, moves
 * both tokens into httpOnly cookies and hands the client only the identity
 * half. It is declared here because the server-side auth code is typed
 * against it.
 */
export interface AuthTokens {
  accessToken: string;
  /** Always `"Bearer"`. */
  tokenType: string;
  /** Access token lifetime, in seconds. */
  expiresIn: number;
  /** Opaque, single-use, rotated on every exchange. */
  refreshToken: string;
  /** Refresh token lifetime, in seconds. */
  refreshExpiresIn: number;
  username: string;
  roles: Role[];
}

/** The identity half of a session — safe to render, carries no credential. */
export interface SessionUser {
  username: string;
  roles: Role[];
}

// ---------------------------------------------------------------------------
// Paging — api/dto/PagedResponse.java
// ---------------------------------------------------------------------------

export interface PagedResponse<T> {
  content: T[];
  /** Zero-based. */
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

// ---------------------------------------------------------------------------
// Payments — api/dto/PaymentDetailResponse.java,
//            application/dto/PaymentResponse.java, api/dto/PaymentRequest.java
// ---------------------------------------------------------------------------

export interface PaymentDetail {
  paymentId: string;
  accountId: string;
  /** Decimal string. */
  amount: string;
  /** ISO 4217. */
  currency: string;
  status: TransactionStatus;
  /** The idempotency key the payment was submitted with. */
  reference: string | null;
  /**
   * 0–100. `null` for a USER caller — the backend withholds it so fraud
   * thresholds cannot be probed by an account holder.
   */
  riskScore: number | null;
  createdAt: string;
  /** `null` while still pending. */
  processedAt: string | null;
}

/** What POST /api/v1/payments returns. Note: `transactionId`, not `paymentId`. */
export interface PaymentResult {
  transactionId: string;
  status: TransactionStatus;
  message: string | null;
}

export interface CreatePaymentBody {
  accountId: string;
  /** Decimal string; backend validates > 0 with at most 4 decimal places. */
  amount: string;
  currency: string;
}

export interface PaymentHistoryQuery {
  /** ADMIN only. A USER asking for another account is refused with 403. */
  accountId?: string;
  status?: TransactionStatus;
  /** ISO-8601 instant. */
  from?: string;
  to?: string;
  /** Exact idempotency key. */
  reference?: string;
  page?: number;
  size?: number;
  sort?: PaymentSortField;
  direction?: SortDirection;
}

// ---------------------------------------------------------------------------
// Accounts — api/dto/AccountResponse.java, api/dto/CreateAccountRequest.java
// ---------------------------------------------------------------------------

export interface Account {
  accountId: string;
  accountNumber: string;
  /** Decimal string. Only a payment changes this. */
  balance: string;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountBody {
  /** Omit to have an unguessable one generated. Letters, digits, hyphens. */
  accountNumber?: string;
  /** Omit to create unlinked. The identity must not already have an account. */
  userId?: string;
}

export interface AccountListQuery {
  status?: AccountStatus;
  accountNumber?: string;
  page?: number;
  size?: number;
  sort?: AccountSortField;
  direction?: SortDirection;
}

// ---------------------------------------------------------------------------
// Dashboard — api/dto/DashboardResponses.java
// ---------------------------------------------------------------------------

/** An amount is only ever reported together with its currency. */
export interface CurrencyAmount {
  currency: string;
  count: number;
  amount: string;
}

export interface DashboardWindow {
  from: string;
  to: string;
}

export interface PaymentMetrics {
  totalPayments: number;
  completedPayments: number;
  failedPayments: number;
  /** Turned down by fraud assessment — deliberate refusals, not failures. */
  fraudRejectedPayments: number;
  /** Only statuses that actually occur in the window are present. */
  countsByStatus: Partial<Record<TransactionStatus, number>>;
  /**
   * One entry per currency. A list rather than a single total because amounts
   * in different currencies cannot be summed into anything meaningful.
   */
  completedTotals: CurrencyAmount[];
}

export interface AccountMetrics {
  totalAccounts: number;
  countsByStatus: Partial<Record<AccountStatus, number>>;
  totalBalance: string;
  /** The backend's own caveat about why this is a single figure. */
  totalBalanceNote: string;
}

export interface DailyVolume {
  /** ISO date, `YYYY-MM-DD`. Days with no activity are absent, not zero. */
  day: string;
  currency: string;
  paymentCount: number;
  completedCount: number;
  completedAmount: string;
}

export interface DashboardOverview {
  window: DashboardWindow;
  payments: PaymentMetrics;
  accounts: AccountMetrics;
  recentPayments: PaymentDetail[];
}

/**
 * GET /api/v1/admin/dashboard/revenue.
 *
 * `revenueModel` is always `"NOT_AVAILABLE"`: the backend records an amount
 * per transaction and no fee, commission or platform share, so revenue cannot
 * be derived. These figures are payment volume. The UI must say so.
 */
export interface PaymentVolume {
  window: DashboardWindow;
  revenueModel: string;
  revenueNote: string;
  completedVolume: CurrencyAmount[];
  daily: DailyVolume[];
}

// ---------------------------------------------------------------------------
// Outbox operations — api/dto/OutboxResponses.java
// ---------------------------------------------------------------------------

export interface OutboxHealth {
  countsByStatus: Partial<Record<OutboxEventStatus, number>>;
  pending: number;
  published: number;
  /** Each one is a committed payment whose event never reached the broker. */
  parked: number;
  needsAttention: boolean;
}

export interface ParkedEvent {
  eventId: string;
  /** The payment transaction this event describes. */
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  status: OutboxEventStatus;
  attempts: number;
  /** High values mean re-driving is not the fix. */
  redriveCount: number;
  lastError: string | null;
  createdAt: string;
  failedAt: string | null;
  redrivenAt: string | null;
}

export interface RedriveResult {
  redriven: number;
  /** Per-call ceiling. If `redriven` equals it, repeat until it returns zero. */
  limit: number;
}

// ---------------------------------------------------------------------------
// Errors — RFC 7807, as produced by api/exception/GlobalExceptionHandler.java
//          and api/security/ProblemDetailWriter.java
// ---------------------------------------------------------------------------

/**
 * The backend answers every failure with `application/problem+json`.
 *
 * `type` is a backend-local path such as `/errors/invalid-credentials`, never
 * an absolute URI. `errors` is present only on a 400 from bean validation, and
 * maps field name to message.
 */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  timestamp?: string;
  errors?: Record<string, string>;
}
