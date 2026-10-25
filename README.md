# MarketPilot AI

Conversational marketing automation for nontechnical business owners.

## Product direction

MarketPilot is an approval-first AI marketing assistant. A user describes an outcome in plain language, the assistant prepares platform-specific campaign content, and the user approves the final campaign before anything is published. Automation can be enabled progressively later.

## Current foundation

- Next.js 16 App Router
- React 19
- Material UI 9
- Strict TypeScript
- Conversation-first campaign workspace
- Campaign preview with per-channel toggles
- Campaign, results, and business sections
- API-style fixture -> mapping layer -> UI model pattern
- Playwright browser coverage for Chromium, Firefox, and WebKit
- GitHub Actions quality and browser-test pipelines

The current UI uses demo data only. Social publishing, AI providers, authentication, persistence, Stripe, and advertising APIs are deliberately not faked as connected services.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e:ci
```

## Environment

Copy `.env.example` to `.env.local` when backend integrations are introduced. Never commit production secrets.

## Next milestones

1. Authentication and organization/business tenancy.
2. PostgreSQL persistence and campaign versioning.
3. AI orchestration with structured tool calls.
4. Social OAuth capability registry and Instagram publishing.
5. Stripe subscriptions, entitlements, and AI credit ledger.
6. Scheduling workers, retries, audit logs, and analytics ingestion.
