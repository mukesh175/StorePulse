# StorePulse

**Know what needs attention. Every day.**

StorePulse is an embedded Shopify app that watches a merchant's store and answers three questions every
morning: **what happened**, **why it matters**, and **what should I do**. Instead of asking merchants to
inspect orders, inventory, products and refunds by hand, StorePulse monitors continuously and raises a small
number of high-signal alerts.

---

## 1. Project overview

- **Stack:** Next.js 15 (App Router, JavaScript), React 19, Bootstrap 5, Prisma + Neon PostgreSQL, Resend,
  Vercel + Vercel Cron, Shopify Admin GraphQL API, Shopify App Bridge.
- **No** TypeScript, Tailwind, Firebase, MongoDB, Supabase or Redis.
- Deployable to Vercel as-is.

## 2. Features

| Area | What it does |
| --- | --- |
| **Daily Store Brief** | One morning email + dashboard summary per store, in the store's own timezone. |
| **Alert engine** | Modular rules → fingerprinted alerts → deduplicated notifications. |
| **Inventory rules** | Unexpected sold out (critical), low stock (configurable threshold). |
| **Order rules** | Delayed fulfillment — warning at 24h, critical at 48h (configurable). |
| **Refund rule** | Refund-rate spike vs a 28-day baseline, with minimum-sample guardrails. |
| **Sales rules** | 7-day revenue / order-volume drops, revenue growth, record days. |
| **Product rules** | Per-product sales drops and demand spikes, with restock guidance. |
| **Store health** | 0–100 score with per-category penalty caps. |
| **Alert center** | Filter by severity, category and status; resolve / dismiss / snooze / reopen. |
| **Reports** | 30-day revenue, orders, refunds; 14-day alert trend; top products. |
| **Notifications** | Email (instant critical, daily digest, weekly summary), in-app, browser. |
| **Demo mode** | Generates a realistic sample store — no Shopify connection required. |

### Alert types

`INVENTORY_SOLD_OUT`, `INVENTORY_LOW_STOCK`, `ORDER_DELAYED`, `REFUND_SPIKE`, `SALES_REVENUE_DROP`,
`SALES_ORDER_DROP`, `SALES_REVENUE_UP`, `SALES_RECORD_DAY`, `PRODUCT_SALES_DROP`, `PRODUCT_DEMAND_SPIKE`.

## 3. Architecture

```
Shopify webhook ──► /api/webhooks/[topic]
                     │  1. verify HMAC
                     │  2. store WebhookEvent (unique shop+topic+eventId ⇒ idempotent)
                     │  3. run a short, DB-only handler
                     ▼
                 Alert rules (lib/alerts/rules/*.js)
                     │  pure functions → alert definitions
                     ▼
                 Alert engine (lib/alerts/engine.js)
                     │  fingerprint = sha1(type | resourceId | scope)
                     │  upsert on (shopId, fingerprint) ⇒ never duplicates
                     ▼
                 Notification dispatch (lib/notifications/dispatch.js)
                        unique (shopId, dedupeKey) on NotificationLog
                        ⇒ an email can physically only be sent once
```

Vercel Cron covers what webhooks cannot see — the passage of time:

**Deployed schedule (`vercel.json`) — Hobby-compatible:**

| Cron | Schedule | Purpose |
| --- | --- | --- |
| `/api/cron/daily` | `30 2 * * *` (02:30 UTC / 08:00 IST) | Metrics + alert scan + daily digest. |
| `/api/cron/weekly-summary` | `30 3 * * 1` | Weekly report. |

Vercel's **Hobby plan only allows cron expressions that fire at most once per day**, so the three
higher-frequency jobs are merged into `/api/cron/daily`. Those endpoints still exist and work — on the Pro plan,
swap the `crons` array in `vercel.json` for the split schedule below to get near-real-time scanning and
per-timezone digest delivery:

```json
"crons": [
  { "path": "/api/cron/metrics",        "schedule": "10 * * * *" },
  { "path": "/api/cron/scan",           "schedule": "*/30 * * * *" },
  { "path": "/api/cron/daily-digest",   "schedule": "0 * * * *" },
  { "path": "/api/cron/weekly-summary", "schedule": "30 6 * * 1" }
]
```

**Trade-off on Hobby:** the digest goes out at one fixed UTC time for every store rather than at each
merchant's local `digestHour`. Pick a UTC hour that suits your merchants' timezone (`30 2 * * *` is 08:00 in
IST). Time-based alerts are detected once a day instead of every 30 minutes; webhook-driven alerts
(sold-out, low stock, new orders) are still instant on both plans.

```
app/
  (app)/            dashboard, alerts, orders, products, inventory, reports, notifications, settings
  api/              auth, webhooks, cron, alerts, dashboard, notifications, settings, sync, demo
  onboarding/
components/         dashboard, alerts, charts, navigation, settings, onboarding, ui
lib/
  shopify/          auth, client (GraphQL + retry), queries, service, webhooks, session, urls
  alerts/           engine, scan, queries, rules/
  notifications/    dispatch
  email/            resend, templates
  webhooks/         mappers, process
  utils/            dates (timezone-aware), format
  prisma.js metrics.js brief.js health.js reports.js sync.js billing.js demo.js cron.js api.js env.js
prisma/schema.prisma
```

## 4. Prerequisites

- Node.js 20+ (developed on 22)
- A Shopify Partner account and a development store
- A Neon PostgreSQL database
- A Resend account (optional for local development)
- A public HTTPS URL for OAuth and webhooks (`ngrok`, `cloudflared`, or a Vercel preview deployment)

## 5. Shopify Partner setup

1. Go to <https://partners.shopify.com> → **Apps** → **Create app** → **Create app manually**.
2. Copy the **Client ID** (`SHOPIFY_API_KEY`) and **Client secret** (`SHOPIFY_API_SECRET`).
3. Set **App URL** to `https://<your-domain>`.
4. Add the allowed redirection URL: `https://<your-domain>/api/auth/callback`.
5. Under **App setup → Embedded app**, keep "Embed app in Shopify admin" enabled.
6. Scopes are requested at OAuth time from `SHOPIFY_SCOPES`; the default set is
   `read_products,read_orders,read_inventory,read_customers,read_locations`.

## 6. Neon setup

1. Create a project at <https://neon.tech>.
2. Copy **both** connection strings:
   - the **pooled** string (`-pooler` host) → `DATABASE_URL`
   - the **direct** string → `DIRECT_URL` (Prisma Migrate cannot run through the pooler)
3. Append `?sslmode=require` (the pooled URL should also carry `&pgbouncer=true&connect_timeout=15`).

## 7. Environment variables

Copy `.env.example` to `.env` and fill it in:

```bash
cp .env.example .env
```

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon pooled connection string. |
| `DIRECT_URL` | yes | Neon direct connection string (migrations). |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` | yes | From the Partner dashboard. |
| `SHOPIFY_APP_URL` | yes | Public HTTPS base URL, no trailing slash. |
| `SHOPIFY_SCOPES` | yes | Comma-separated. |
| `SHOPIFY_API_VERSION` | no | Defaults to `2025-01`. |
| `RESEND_API_KEY` | no | Without it, emails are logged as `SKIPPED` instead of sent. |
| `RESEND_FROM_EMAIL` | no | e.g. `StorePulse <alerts@yourdomain.com>`. |
| `CRON_SECRET` | yes | Bearer token required by every cron endpoint. |
| `APP_SESSION_SECRET` | yes | 32+ random chars; signs the session cookie. |
| `DEMO_MODE` | no | `true` enables the demo store and `/api/demo`. |
| `BILLING_ENABLED` | no | Leave unset — billing is inert in V1. |

`.env` is git-ignored. Never commit it.

## 8. Local development

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:3000>. With `DEMO_MODE=true` you can click **Open demo** to generate a sample store
(100 products / 500 variants / 50 orders, including 3 delayed orders, 2 low-stock variants and 1 unexpectedly
sold-out variant) and explore the whole UI without connecting Shopify.

## 9. Prisma migration

```bash
npx prisma migrate dev --name init
```

```bash
npx prisma generate
```

For production/CI:

```bash
npx prisma migrate deploy
```

Inspect data with:

```bash
npx prisma studio
```

## 10. Shopify OAuth setup

The flow is implemented end to end:

1. `GET /api/auth?shop=<store>.myshopify.com` — validates the shop domain, verifies Shopify's `hmac` when
   present, stores a single-use `OAuthState`, redirects to Shopify's authorize screen.
2. `GET /api/auth/callback` — verifies `hmac`, redeems and deletes the state, exchanges the code for an access
   token, upserts the `Store`, creates default settings, syncs the shop profile (currency/timezone), registers
   webhooks, sets a signed HTTP-only session cookie, and redirects to `/onboarding`.

The access token is stored server-side only and is never sent to the browser. The authenticated shop is always
derived from the signed session cookie — never from a query or body parameter.

Local OAuth needs a public URL:

```bash
npx cloudflared tunnel --url http://localhost:3000
```

Then set `SHOPIFY_APP_URL` to the tunnel URL and update the redirect URL in the Partner dashboard.

## 11. Webhook setup

Webhooks are registered automatically during OAuth (and again on any sync with `registerWebhooks: true`).
Registered topics: `orders/create`, `orders/updated`, `orders/fulfilled`, `refunds/create`, `products/create`,
`products/update`, `products/delete`, `inventory_levels/update`, `customers/create`, `app/uninstalled`.

Every request is HMAC-verified before anything else happens. Verified events are persisted to `WebhookEvent`
with a unique `(shopDomain, topic, eventId)` key, so Shopify's at-least-once redelivery is a no-op. Handlers do
database work only — no Shopify API calls happen inside the webhook request path.

### Mandatory privacy webhooks

`customers/data_request`, `customers/redact` and `shop/redact` are declared in `shopify.app.toml` and handled by
the same verified endpoint. `customers/redact` nulls the customer name and email on mirrored orders (the
numbers that feed metrics stay intact); `shop/redact` deletes the `Store` row, which cascades to every related
table.

### App configuration (`shopify.app.toml`)

The Shopify CLI needs this file to exist before `shopify app deploy` will run. It carries the client ID, app
URL, scopes, redirect URL and the privacy webhook endpoints. Note that `shopify app deploy` pushes *this
configuration* to the Partner dashboard — it does **not** deploy the Next.js app itself. That is `vercel --prod`.
If your deployed domain changes, update `application_url` and the URLs under `[auth]` and
`[webhooks.privacy_compliance]`, then re-run the deploy.

The business webhooks (orders, products, inventory, refunds, uninstall) are registered per-shop at OAuth time
via the Admin GraphQL API in `lib/shopify/webhooks.js`, not declared in the TOML.

Test with the Shopify CLI:

```bash
shopify app webhook trigger --topic=orders/create --address=https://<your-domain>/api/webhooks/orders-create
```

## 12. Resend setup

1. Create an API key at <https://resend.com/api-keys> → `RESEND_API_KEY`.
2. Verify your sending domain, then set `RESEND_FROM_EMAIL`.
3. Templates live in `lib/email/templates.js`: critical alert, daily digest, weekly summary.

Every send is recorded in `NotificationLog` with status `SENT`, `FAILED` or `SKIPPED`, visible at
`/notifications`.

## 13. Vercel deployment

```bash
vercel link
```

```bash
vercel env add DATABASE_URL production
```

Repeat for `DIRECT_URL`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SHOPIFY_SCOPES`,
`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CRON_SECRET`, `APP_SESSION_SECRET`.

```bash
npx prisma migrate deploy
```

```bash
vercel --prod
```

`npm run build` runs `prisma generate` first, which is required on Vercel's build cache.

## 14. Vercel Cron configuration

`vercel.json` declares two daily jobs (see the Hobby/Pro note in **Architecture**). Vercel automatically sends
`Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` exists in the project's environment variables —
`lib/cron.js` rejects anything else with 401.

Run one manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://<your-domain>/api/cron/daily"
```

## 15. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `Invalid request signature` on install | `SHOPIFY_API_SECRET` does not match the app, or the URL was hand-edited. |
| Redirect loop back to `/` | Session cookie blocked. In production the cookie is `SameSite=None; Secure`, which requires HTTPS. |
| `Shopify rejected the access token` | App was uninstalled/reinstalled — reinstall to mint a fresh token. |
| Webhooks return 401 | The request did not come from Shopify, or the secret is wrong. |
| No digest email | Check `/notifications` for `SKIPPED`/`FAILED`, confirm `RESEND_API_KEY`, and that the store's local hour matches `digestHour`. |
| `Can't reach database server` | Use the **pooled** Neon URL for `DATABASE_URL`; check `sslmode=require`. |
| Migrations hang | `DIRECT_URL` must be the non-pooled Neon host. |
| Empty dashboard | Run a sync (**Re-sync** in the top bar) — metrics are derived from synced orders. |

## 16. Production checklist

- [ ] `prisma migrate deploy` has run against the production database
- [ ] All environment variables set in Vercel (Production **and** Preview)
- [ ] `SHOPIFY_APP_URL` matches the deployed domain and the Partner dashboard redirect URL
- [ ] `APP_SESSION_SECRET` is a fresh 32+ character random value
- [ ] `CRON_SECRET` set; both cron jobs visible in the Vercel dashboard
- [ ] `DEMO_MODE` is **not** `true` in production
- [ ] Resend domain verified and `RESEND_FROM_EMAIL` uses it
- [ ] Test install on a development store: OAuth → onboarding → dashboard
- [ ] Confirm webhooks appear under the store's app in the Partner dashboard
- [ ] Trigger `orders/create` and confirm the order appears within seconds
- [ ] Set a variant to 0 in Shopify and confirm a `CRITICAL` sold-out alert appears once (not repeatedly)
- [ ] Force the digest cron and confirm one email arrives
- [ ] Uninstall the app and confirm `uninstalledAt` is set and the token is cleared

---

## Demo mode

With `DEMO_MODE=true`, `POST /api/demo` builds a deterministic sample store under the reserved domain
`storepulse-demo.myshopify.com`, flagged `isDemo: true`. Demo stores never call the Shopify API and have email
disabled by default, so demo data can never mix with a real merchant's data.

## What is intentionally *not* built

Per the V1 scope: no AI chatbot, no WhatsApp or Slack channels, no active billing charges, no attribution or
forecasting. The notification layer is channel-agnostic (`NotificationChannel` enum + `dispatch.js`) and the
billing module (`lib/billing.js`) carries the real plan catalogue and entitlement helpers, so both can be
switched on without touching calling code.
