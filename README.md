# MarketPilot AI

Conversational, approval-first marketing automation for nontechnical business owners.

MarketPilot turns a plain-language marketing request into channel-specific campaign content, keeps confirmed business context in one place, requires explicit approval, and can schedule approved content to connected channels.

## Production MVP

The current MVP includes:

- Next.js 16 App Router, React 19, Material UI 9, strict TypeScript.
- PostgreSQL persistence with Prisma 7 and organization/business tenancy.
- Email/password authentication with HTTP-only server sessions.
- AES-256-GCM encryption for social access and refresh tokens.
- Business/brand profile used as confirmed AI context.
- Gemini 3.8 Flash text generation with Zod validation on Google's free developer tier.
- Immutable campaign versions and conversational revisions.
- Explicit campaign approval and schedule invalidation after material edits.
- AI credits and server-side subscription entitlements.
- Stripe hosted Checkout, credit packs, webhook synchronization, and Billing Portal.
- S3-compatible browser uploads plus Cloudflare Workers AI image generation.
- Instagram, X, and TikTok OAuth connections.
- Scheduled publishing with atomic claims, retries, audit records, and failure states.
- TikTok per-post privacy/interactions/consent flow using current creator capabilities.
- Consent-aware email contact import, SMTP delivery, and one-click unsubscribe.
- Organic performance snapshots for X, Instagram, and TikTok where the connected API exposes them.
- Privacy and terms launch templates with recorded acceptance timestamps.
- Health endpoint at `/api/health`.
- Playwright regression coverage across Chromium, Firefox, and WebKit.
- GitHub Actions for Prisma validation, lint, strict typecheck, build, and browser tests.

Paid advertising is **not** part of this organic MVP. When paid ads are added, customers should continue paying Meta/TikTok/X directly for ad spend. MarketPilot should charge its own SaaS/management fees separately rather than custody advertising budgets.

## Architecture

The app is a modular monolith:

- `src/app`: App Router pages and route handlers.
- `src/features`: interactive product surfaces.
- `src/domain`: UI/domain types.
- `src/mappers`: API-to-UI mapping.
- `src/lib`: authentication, AI, campaigns, billing, OAuth, media, publishing, metrics, entitlements, audit, and database services.
- `prisma/schema.prisma`: source-of-truth database model.
- `tests/e2e`: cross-browser user journeys.

External provider values remain server-side. No provider secret should use a `NEXT_PUBLIC_` prefix.

For the zero-fixed-cost deployment path, follow [`FREE_STACK_SETUP.md`](./FREE_STACK_SETUP.md).

## Local setup

Requirements:

- Node.js 22+
- PostgreSQL
- npm

Install:

```bash
npm install
cp .env.example .env.local
npm run db:validate
npm run db:push
npm run dev
```

Open `http://localhost:3000`.

`db:push` is appropriate for creating an initial development/staging database from the current schema. Before the first production release, generate and review a baseline Prisma migration against the production database workflow your hosting environment uses.

## Required environment configuration

Start from `.env.example`.

### Core

- `NEXT_PUBLIC_APP_URL`: externally reachable application origin.
- `DATABASE_URL`: PostgreSQL connection string.
- `MARKETPILOT_DEMO_MODE`: leave `false` outside automated browser tests.
- `TOKEN_ENCRYPTION_KEY`: a high-entropy 32-byte key; base64 is recommended.
- `CRON_SECRET`: random bearer secret used by scheduled worker endpoints.
- `UNSUBSCRIBE_SECRET`: independent HMAC secret for unsubscribe links.
- `NEXT_PUBLIC_LEGAL_ENTITY_NAME`: final operator legal name.
- `NEXT_PUBLIC_LEGAL_CONTACT_EMAIL`: privacy/support contact published in the privacy notice.

Generate independent secrets, for example:

```bash
openssl rand -base64 32
```

Do not reuse one secret for token encryption, cron authorization, and unsubscribe links.

### Gemini AI

- `GEMINI_API_KEY`
- `GEMINI_MODEL` (default: `gemini-3.8-flash`)
- `GEMINI_FALLBACK_MODEL` (default: `gemini-3.5-flash-lite`)

Campaign text generation uses Gemini's free developer tier by default, so it does not consume OpenAI API credits. Internal MarketPilot credits remain only as product usage controls.

Gemini's current image-generation APIs do not have a free API tier, so MarketPilot uses Cloudflare Workers AI for optional campaign images instead. Configure `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_API_TOKEN`, and optionally `CLOUDFLARE_IMAGE_MODEL` (default `@cf/black-forest-labs/flux-1-schnell`). Cloudflare currently includes 10,000 Workers AI neurons per day on its Free plan; once that free allowance is exhausted, Free-plan AI calls fail rather than automatically charging overage. Users can always upload their own media instead.

### Object storage

MarketPilot supports S3-compatible storage:

- `S3_REGION`
- `S3_ENDPOINT` when using a non-AWS S3-compatible provider.
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_PUBLIC_BASE_URL`

The public base URL must serve uploaded/generated media over HTTPS because social platforms fetch campaign assets from it.

For TikTok `PULL_FROM_URL`, the media URL must be under a domain or URL prefix verified in the TikTok developer console.

### Stripe

Configure:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- recurring prices:
  - `STRIPE_PRICE_STARTER`
  - `STRIPE_PRICE_GROWTH`
  - `STRIPE_PRICE_PRO`
  - `STRIPE_PRICE_AGENCY`
- one-time credit prices:
  - `STRIPE_PRICE_CREDITS_100`
  - `STRIPE_PRICE_CREDITS_300`
  - `STRIPE_PRICE_CREDITS_1000`

Plans currently modeled in the application:

| Plan | Price | Businesses | Channels | Monthly posts | Monthly credits | MVP status |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Starter | EUR 19 | 1 | 2 | 15 | 100 | Available |
| Growth | EUR 49 | 1 | 4 | 60 | 350 | Available |
| Professional | EUR 99 | 3 | 12 | 200 | 900 | Defined, checkout disabled |
| Agency | EUR 249 | 10 | 40 | 600 | 2500 | Defined, checkout disabled |

Point Stripe webhooks to:

```text
POST https://YOUR_DOMAIN/api/billing/webhook
```

Subscribe at minimum to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`

New accounts receive a seven-day Starter trial with 100 AI credits. Publishing is blocked after the trial expires until a paid subscription becomes active.

Credit grants are idempotent by Stripe invoice/Checkout identifier.

## Social providers

### Instagram

Set:

- `META_APP_ID`
- `META_APP_SECRET`
- `META_GRAPH_VERSION`
- `META_SCOPES`

Callback:

```text
https://YOUR_DOMAIN/api/connections/instagram/callback
```

The current flow targets Instagram professional accounts through Instagram Login. Configure the corresponding Meta app products, redirect URI, permissions, and app review before production use.

Instagram publishing requires media.

### X

Set:

- `X_CLIENT_ID`
- `X_CLIENT_SECRET`
- `X_SCOPES`

Callback:

```text
https://YOUR_DOMAIN/api/connections/x/callback
```

The app uses OAuth 2.0 Authorization Code with S256 PKCE and refresh-token rotation when available.

### TikTok

Set:

- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `TIKTOK_SCOPES`

Callback:

```text
https://YOUR_DOMAIN/api/connections/tiktok/callback
```

Before public Direct Post:

1. Configure Login Kit and Content Posting API.
2. Verify the `S3_PUBLIC_BASE_URL` domain/prefix for `PULL_FROM_URL`.
3. Complete TikTok's Content Posting audit. Unaudited clients are restricted.
4. Ensure requested scopes are approved.
5. Test the per-campaign TikTok settings dialog. It intentionally has no privacy default and requires explicit upload consent.

The worker polls TikTok post status before treating a job as successful.

## Email marketing

Set:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`

Contacts can be imported from **My business**. The UI explicitly requires the account owner to certify an appropriate marketing basis. Each outgoing marketing email includes unsubscribe headers and a signed unsubscribe URL.

Before launch, confirm the operator's GDPR/ePrivacy/direct-marketing process, privacy notice, consent evidence, retention, bounce/complaint handling, and suppression procedures with counsel and the selected mail provider.

## Scheduled workers

Publishing:

```text
POST /api/cron/publish
Authorization: Bearer YOUR_CRON_SECRET
```

Metrics:

```text
POST /api/cron/metrics
Authorization: Bearer YOUR_CRON_SECRET
```

Invoke publishing at least every minute when timely scheduling matters. Metrics can normally run less frequently, for example hourly. Use the scheduler supplied by your deployment platform or an external cron service.

The publishing worker:

- atomically claims due jobs;
- never publishes a disabled channel;
- refreshes provider tokens where supported;
- retries failures with bounded exponential backoff;
- stores provider identifiers;
- marks the campaign published only after all jobs finish.

## Development and CI

Quality checks:

```bash
npm run db:validate
npm run lint
npm run typecheck
npm run build
```

Browser regression:

```bash
npx playwright install chromium firefox webkit
npm run build
npm run test:e2e:ci
```

The Playwright server explicitly sets `MARKETPILOT_DEMO_MODE=true`. Demo mode exists only to make regression tests deterministic without a live database or third-party credentials. Production defaults to live authenticated mode.

## Launch checklist

Before accepting real customers:

1. Make the GitHub repository private.
2. Provision production PostgreSQL and apply a reviewed baseline migration.
3. Configure independent encryption, cron, and unsubscribe secrets.
4. Configure HTTPS and the final public application URL.
5. Configure S3-compatible storage and verify the public media domain.
6. Create Stripe products/prices and register the webhook.
7. Complete Meta, X, and TikTok developer configuration/review.
8. Configure a production mail provider and sender authentication.
9. Set the final legal entity/contact details and have the privacy/terms templates reviewed by counsel.
10. Configure scheduled calls for publishing and metrics ingestion.
11. Verify database backups, monitoring, alerting, and log retention.
12. Run manual acceptance tests against real sandbox/test provider accounts before enabling customer access.

## Security notes

- Social tokens are encrypted at rest with AES-256-GCM.
- Session tokens are random, stored only as SHA-256 hashes server-side, and sent in HTTP-only SameSite cookies.
- OAuth state values are hashed and expire after ten minutes.
- Provider client secrets remain server-only.
- Campaign edits after approval revoke approval and pending schedules.
- Publish jobs have deterministic idempotency keys and atomic claim transitions.
- User-supplied email recipients are never used unless stored as subscribed contacts.
- No advertising budgets or card details are stored by MarketPilot.

This repository is application code, not a substitute for production infrastructure review, penetration testing, provider app review, or legal advice.
