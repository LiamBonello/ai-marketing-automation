# Free Stack Setup

This is the zero-fixed-cost MVP configuration for MarketPilot.

## Already provisioned

- Text AI: Google Gemini free developer tier.
- Image AI: Cloudflare Workers AI free daily allowance.
- Database: existing Supabase Free project, isolated in the `marketpilot` Postgres schema.
- Media bucket: public Supabase Storage bucket `marketpilot-media`.
- Hosting target: Netlify Free configuration is included in `netlify.toml`.
- Scheduled workers: GitHub Actions workflow in `.github/workflows/workers.yml`.
- Database schema: MarketPilot tables are already created in Supabase.
- Existing unrelated Supabase `public` tables were left untouched.

## 1. Google Gemini

Open Google AI Studio and create an API key.

Set:

```env
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.8-flash
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite
```

Do not commit the API key.

## 2. Cloudflare Workers AI

Create or use a Cloudflare account.

Create a Workers AI API token that is allowed to run Workers AI for your account.

Set:

```env
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_AI_API_TOKEN=...
CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-1-schnell
```

The app can still use uploaded media when the free daily AI image allowance is exhausted.

## 3. Supabase database

Project:

```text
ldwuqulwpecgjfhqpbbw
Region: eu-central-1
Schema: marketpilot
```

The schema and application tables are already provisioned.

From Supabase Dashboard -> Connect, copy two strings:

1. **Transaction pooler** (port 6543) for runtime/serverless traffic. Save it as `DATABASE_URL`. Add `pgbouncer=true` and `sslmode=require` query parameters if they are not already present.
2. **Session pooler** (port 5432) for Prisma admin/migration commands. Save it as `DIRECT_URL`. A direct connection may also be used when your network supports Supabase's IPv6 direct endpoint.

Set:

```env
DATABASE_URL=postgresql://...:6543/postgres?pgbouncer=true&sslmode=require
DIRECT_URL=postgresql://...:5432/postgres?sslmode=require
DATABASE_SCHEMA=marketpilot
```

Keep the database password server-side. The application-side PostgreSQL pool is capped at one connection per warm serverless instance; Supabase's pooler handles concurrency.

## Supabase schema security

MarketPilot is stored in the dedicated `marketpilot` schema. The Supabase `anon` and `authenticated` roles currently have no `USAGE` privilege on that schema, and the application accesses it through the server-side Prisma PostgreSQL connection.

Supabase's database advisor still reports that RLS is disabled on the MarketPilot tables. Do not expose `marketpilot` in the Supabase Data API unless you first enable RLS and create policies appropriate to the application's organization/business authorization model.

The unrelated pre-existing `public` schema has its own advisor findings and should be reviewed separately before that older application is exposed publicly.

## 4. Supabase media storage

The bucket already exists:

```text
marketpilot-media
```

Known non-secret values:

```env
S3_REGION=eu-central-1
S3_ENDPOINT=https://ldwuqulwpecgjfhqpbbw.storage.supabase.co/storage/v1/s3
S3_BUCKET=marketpilot-media
S3_PUBLIC_BASE_URL=https://ldwuqulwpecgjfhqpbbw.supabase.co/storage/v1/object/public/marketpilot-media
```

In Supabase Dashboard -> Storage -> S3 Configuration, create a server-side S3 access-key pair.

Set:

```env
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

Never expose these credentials to browser code.

Supabase Free limits individual uploads to 50 MB. MarketPilot enforces the same limit.

## 5. Application secrets

Generate three independent random secrets:

```bash
openssl rand -base64 32
openssl rand -base64 32
openssl rand -base64 32
```

Set them separately:

```env
TOKEN_ENCRYPTION_KEY=...
CRON_SECRET=...
UNSUBSCRIBE_SECRET=...
```

Do not reuse the same value.

## 6. Netlify

Import the GitHub repository into Netlify.

The repository includes:

```text
netlify.toml
Node 22
npm run build
```

Add the environment variables from `.env.example` in Netlify's environment-variable settings.

Set:

```env
MARKETPILOT_DEMO_MODE=false
NEXT_PUBLIC_APP_URL=https://YOUR_NETLIFY_OR_CUSTOM_DOMAIN
NEXT_PUBLIC_LEGAL_ENTITY_NAME=YOUR_LEGAL_ENTITY
NEXT_PUBLIC_LEGAL_CONTACT_EMAIL=YOUR_SUPPORT_OR_PRIVACY_EMAIL
```

After the first deployment, visit:

```text
https://YOUR_DOMAIN/api/health
```

The database, AI, storage, and configured integrations should report readiness.

## 7. GitHub scheduled workers

After deployment, add these GitHub repository secrets:

```text
MARKETPILOT_APP_URL=https://YOUR_DOMAIN
MARKETPILOT_CRON_SECRET=<same value as CRON_SECRET in Netlify>
```

The included workflow runs:

- publishing every five minutes
- metrics ingestion hourly

Five minutes is the minimum practical GitHub Actions cron interval. Use another scheduler later if exact-to-the-minute publishing is required.

## 8. Email

For a free MVP, Brevo Free is suitable for SMTP.

Configure the authenticated SMTP credentials supplied by Brevo:

```env
SMTP_HOST=...
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM=...
```

Verify the sender/domain before sending real marketing mail.

## 9. Stripe

Stripe has no monthly platform fee for basic Checkout setup, but transaction fees apply when customers pay.

Create recurring prices only for the currently available MVP plans:

- Starter: EUR 19/month
- Growth: EUR 49/month

Create one-time prices for:

- 100 credits
- 300 credits
- 1000 credits

Set the corresponding `STRIPE_*` variables.

Register:

```text
POST https://YOUR_DOMAIN/api/billing/webhook
```

for the event types documented in `README.md`.

Leave Professional and Agency prices blank until those product workflows are released.

## 10. Social providers

### Instagram

Create/configure a Meta app and Instagram professional-account permissions.

Callback:

```text
https://YOUR_DOMAIN/api/connections/instagram/callback
```

### TikTok

Configure Login Kit and Content Posting API.

Callback:

```text
https://YOUR_DOMAIN/api/connections/tiktok/callback
```

Verify the media URL/domain for TikTok pull-from-URL publishing and complete Content Posting review.

### X

X publishing is not part of the zero-cost stack because X currently charges per API resource/request.

Leave all `X_*` variables empty if you want the MVP to remain strictly zero-cost.

## 11. Final acceptance test

Test in this order:

1. Register a user.
2. Edit the business profile.
3. Generate a campaign with Gemini.
4. Revise the campaign conversationally.
5. Generate an image with Cloudflare Workers AI.
6. Upload a custom media file.
7. Toggle channels.
8. Approve the campaign.
9. Connect Instagram/TikTok.
10. Configure TikTok per-post settings when used.
11. Schedule the campaign.
12. Confirm the GitHub worker processes it.
13. Import a consented email contact.
14. Send an email campaign.
15. Test unsubscribe.
16. Test Stripe Checkout in test mode.
17. Confirm results/metric snapshots.

Do not enable real customer access until these flows have been tested with provider sandbox/test accounts.
