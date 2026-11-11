# SentinelPay — frontend

The payments console for the SentinelPay platform. Next.js App Router,
TypeScript, Tailwind v4 and shadcn/ui, talking to the Spring Boot API in this
same repository.

---

## Running it locally

The frontend needs the backend, and the backend needs Postgres, Redis and
RabbitMQ.

**1. Infrastructure**

```bash
docker compose up -d postgres redis rabbitmq
```

**2. Backend** (from the repository root)

```bash
./mvnw -DskipTests package && java -jar sentinel-pay-api/target/sentinel-pay-api-1.0.0-SNAPSHOT-exec.jar
```

> A Spring Boot executable jar is read lazily while the process runs. Rebuilding
> it under a running instance makes classes it has not yet loaded fail with
> `NoClassDefFoundError`. If that happens, restart the process — it is not a
> code fault.

**3. Frontend**

```bash
cd sentinel-pay-frontend && cp .env.example .env.local && pnpm install && pnpm dev
```

The console is at <http://localhost:3000>.

**4. A user to sign in as**

`V2__Create_users_and_roles.sql` deliberately ships no credentials, so a fresh
database has no one to sign in as. Create an identity with a BCrypt hash:

```bash
docker exec -i sentinel-pay-db psql -U sentinel -d sentinelpay
```

An administrator needs no linked account; an account holder needs one, and
`users.account_id` is the link.

### Scripts

| Command        | What it does                        |
| -------------- | ----------------------------------- |
| `pnpm dev`     | Development server                  |
| `pnpm build`   | Production build (runs TypeScript)  |
| `pnpm start`   | Serve the production build          |
| `pnpm lint`    | ESLint                              |

### Configuration

| Variable                     | Default                 | Notes                                            |
| ---------------------------- | ----------------------- | ------------------------------------------------ |
| `SENTINELPAY_API_BASE_URL`   | `http://localhost:8080` | Spring Boot, as seen from the **Next.js server** |
| `SENTINELPAY_COOKIE_SECURE`  | on in production        | `Secure` attribute on session cookies            |

Neither is `NEXT_PUBLIC_`, and that is the point — see below.

---

## Two decisions that shape everything else

### The browser never talks to Spring Boot

Requests go to this Next.js server under `/bff/api/*`, which attaches the access
token and forwards them to `<backend>/api/v1/*`.

Two independent reasons:

1. **The backend has no CORS configuration.** `SecurityConfig` disables CSRF and
   goes stateless but never calls `.cors(...)`, and no `CorsConfigurationSource`
   bean exists anywhere in the repository. A browser on `localhost:3000`
   therefore cannot call `localhost:8080` directly. The alternatives were to add
   CORS to a backend module this work was asked to leave alone, or to make this
   server the browser's only origin.
2. **It is what keeps the tokens out of the browser.**

### Tokens live in httpOnly cookies, not `localStorage`

The backend issues a 15-minute JWT and a 30-day refresh token. Neither is ever
returned to client JavaScript: `POST /bff/auth/login` answers with
`{ username, roles }` and sets the tokens as httpOnly cookies.

Keeping a 30-day refresh token in `localStorage` would make any XSS anywhere in
the app a 30-day account compromise. An httpOnly cookie is not readable by
injected script.

**What that costs, stated plainly:**

- Cookies are attached by the browser automatically, which is a CSRF surface
  that bearer headers do not have. Answered twice over: `SameSite=Lax`, which
  withholds the cookie from cross-site POSTs, and an explicit `Origin` check on
  every mutating proxy request.
- Every API call takes an extra hop through this server.
- `sp_user` carries the identity used to decide which navigation to draw. It is
  httpOnly, but it is still only a UI hint — every authorisation decision is
  made by Spring Security against the signed JWT. Forging it buys a misleading
  menu and nothing else.

### Refresh is single-flighted, and why it has to be

The backend's refresh tokens are single use and rotated, and presenting a
**spent** one is treated as a compromise that revokes the entire session.

A dashboard fires several queries at once. When the access token expires they
all get 401 together — and if each independently exchanged the refresh token,
the first would succeed and the rest would present a spent token, logging the
user out of everything simply for loading a page.

So every exchange goes through one in-flight map keyed by the token being spent
(`src/lib/auth/token-exchange.ts`). Resolved results are cached for a short
window afterwards, because a request whose headers were assembled before the new
`Set-Cookie` landed still arrives carrying the old token.

**Verified:** six concurrent requests with an expired access cookie produced
exactly **one** refresh exchange at the backend, and the session survived.

**Known limitation:** the map is per process. Behind more than one Next.js
instance without sticky sessions, two instances could still race. A shared lock
(the Redis the backend already runs) would be the fix.

---

## Layout

```
src/
├── app/
│   ├── (auth)/login/            Sign-in
│   ├── (dashboard)/             Authenticated shell + pages
│   └── bff/                     The proxy: /bff/api/*, /bff/auth/*
├── components/
│   ├── ui/                      shadcn/ui primitives
│   ├── layout/                  Sidebar, drawer, top bar
│   └── shared/                  Tables, metrics, states
├── features/                    auth · dashboard · payments · accounts · operations · settings
├── lib/
│   ├── api/                     Client, proxy, problem handling, query keys
│   ├── auth/                    Session cookies, token exchange
│   └── utils.ts                 Formatters
├── providers/                   TanStack Query, auth context
├── types/api.ts                 The backend contract, transcribed
└── proxy.ts                     Route guard
```

`src/types/api.ts` mirrors the Java records field for field, with the source
file named per block. Amounts are `string` throughout, never `number`: a ledger
value put through an IEEE-754 double is a ledger value you can no longer trust.

---

## What the backend supports, and what it does not

Everything below was read from the controllers, not assumed. The console states
these limits in the UI rather than hiding them — a dashboard that looks complete
and quietly misleads is worse than one that admits a gap.

**Integrated**

| Endpoint                                  | Used for                                 |
| ----------------------------------------- | ---------------------------------------- |
| `POST /auth/login` `/refresh` `/logout`   | The whole session lifecycle              |
| `POST /payments`                          | Submit, with a client idempotency key    |
| `GET /payments` `/payments/{id}`          | History and detail                       |
| `GET /accounts/me` `/accounts/{id}`       | Account holder's own account             |
| `POST /accounts`                          | Provisioning (ADMIN)                     |
| `GET /admin/accounts`                     | Account listing (ADMIN)                  |
| `GET /admin/dashboard/overview`           | Overview aggregation (ADMIN)             |
| `GET /admin/dashboard/revenue`            | Daily volume, for the chart (ADMIN)      |
| `GET /admin/dashboard/accounts`           | Account snapshot (ADMIN)                 |
| `GET /admin/outbox` `/parked`             | Event delivery health (ADMIN)            |
| `POST /admin/outbox/parked/…/redrive`     | Operator recovery (ADMIN)                |

**Not available, and why**

- **No user directory.** `POST /accounts` takes an optional `userId` to link
  the new account to an identity, and that part works — but no endpoint
  anywhere lists or searches identities, so an administrator has nowhere to
  look a UUID up. The provisioning form says so rather than pretending
  otherwise; a user-picker would mean inventing an API. Unlinked is the usual
  path.
- **No aggregation for an account holder.** `/admin/dashboard/*` is ADMIN-only
  and there is no USER equivalent. The account holder's overview is assembled
  from `/accounts/me` plus `totalElements` on status-filtered pages of
  `/payments` — real counts, done in the database. The one figure that genuinely
  cannot be had is total completed **volume**: summing amounts is something only
  the ADMIN aggregation does, and adding up a page of rows in the browser would
  silently be a per-page total. That tile says so.
- **No platform revenue.** A transaction records an amount and no fee,
  commission or spread, so revenue cannot be derived. `/admin/dashboard/revenue`
  returns `revenueModel: "NOT_AVAILABLE"` and the chart is labelled volume.
- **No balance adjustment, no account status transitions, no refunds.** The
  statuses exist in the domain model but no endpoint transitions them.
- **No registration, password change or password reset.**
- **Login is by `username`, not email.** `LoginRequest` declares
  `@NotBlank @Size(max = 100) String username` with no `@Email`, and the users
  table has no email column. The field is labelled accordingly.
- **The fraud risk score is ADMIN-only.** The backend returns `riskScore: null`
  to an account holder so the thresholds cannot be probed, so the column is not
  rendered for them.

---

### Payment deep links

`/payments/{id}` is a real route, so a payment can be linked to from a ticket
and survives a refresh. Two things follow from the backend's behaviour:

- **A 404 means either "no such payment" or "not yours".** The backend answers
  both identically, because a 403 for the second would confirm the id is real.
  The not-found screen is worded so it never implies the payment exists.
- **The id is shape-checked before the request.** A non-UUID path would be a
  400 from the backend; spending a request and a slice of the rate limit to
  learn that is pointless when the shape is checkable locally.

The list's filters live in the query string rather than in component state, so
opening a payment and coming back restores the exact filtered page — and the
filtered list is itself a shareable link. Row links carry that state in a
`back` parameter.

## Notes on the interface

- **The payment form generates its own idempotency key**, one per opening of the
  dialog, reused across retries. Omitting the header is worse than useless — the
  backend mints one when it is absent, so every retry would be a fresh payment.
- **No automatic retry on any 4xx.** The backend allows 10 sign-ins and 60
  payments a minute; three automatic retries is how a rate limit becomes a
  lockout.
- **Tables are real `<table>` markup** that restacks into cards below 46rem of
  *container* width, so a table squeezed by the sidebar restacks on its own
  width rather than the viewport's.
- **The mobile drawer** is a `popover="manual"` in the top layer, swiped by CSS
  scroll-snap rather than pointer handling, with `inert` on the page behind it
  and focus returned to the trigger on close.
- **Chart colours were validated, not eyeballed** — lightness band, chroma
  floor, adjacent-pair separation under simulated colour blindness, and contrast
  against the surface, in both themes. The hue order is deliberate: green is
  flanked by cool hues because red, orange and green collapse together under the
  commonest forms of colour blindness.
- **Volume is drawn as bars, not an area.** The API omits days with no activity
  rather than reporting zero, and a line would join across them — inventing
  activity that did not happen.
