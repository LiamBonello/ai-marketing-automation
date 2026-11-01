# Local Development Setup

MarketPilot can now run fully locally for application data and media.

Local services:

- PostgreSQL 18.6 in Docker
- Prisma schema in the local `marketpilot` database
- Uploaded/generated media in `public/uploads`
- Gemini API for campaign text
- Cloudflare Workers AI for image generation

Supabase is not required for local development.

## Requirements

Install:

1. Node.js 22 or later
2. Docker Desktop
3. Git

Make sure Docker Desktop is running before starting MarketPilot.

## First-time setup

From the project folder:

```powershell
npm install
npm run db:local:setup
npm run dev
```

Then open:

```text
http://localhost:3000
```

### What `npm run db:local:setup` does

It automatically:

1. Preserves your existing `.env.local`.
2. Keeps your existing Gemini and Cloudflare credentials.
3. Sets the application URL to `http://localhost:3000`.
4. Configures PostgreSQL at `127.0.0.1:5433`.
5. Generates missing encryption, cron, and unsubscribe secrets.
6. Configures local media storage.
7. Starts the PostgreSQL Docker container.
8. Waits until PostgreSQL is healthy.
9. Pushes the Prisma schema into the local database.

Local database credentials are intentionally simple because the database is bound only to `127.0.0.1`:

```text
Host:     127.0.0.1
Port:     5433
Database: marketpilot
User:     marketpilot
Password: marketpilot
```

The local database URL is:

```text
postgresql://marketpilot:marketpilot@127.0.0.1:5433/marketpilot
```

## Useful commands

Start PostgreSQL:

```powershell
npm run db:local:up
```

Stop PostgreSQL without deleting data:

```powershell
npm run db:local:down
```

Start PostgreSQL, create/update the schema, then start MarketPilot:

```powershell
npm run dev:local
```

Push the current Prisma schema:

```powershell
npm run db:push
```

Open Prisma Studio:

```powershell
npx prisma studio
```

Reset the local database completely:

```powershell
npm run db:local:reset
```

Warning: `db:local:reset` deletes the Docker PostgreSQL volume and all local MarketPilot data.

## Local media

Local development uses:

```env
MEDIA_STORAGE=local
LOCAL_MEDIA_DIR=public/uploads
```

Uploaded files and Cloudflare-generated campaign images are written below:

```text
public/uploads/
```

This directory is ignored by Git.

Local media URLs look like:

```text
http://localhost:3000/uploads/businesses/...
```

This is suitable for local UI testing.

Instagram and TikTok cannot fetch `localhost` media from the public internet. When testing real social publishing later, switch `MEDIA_STORAGE=s3` and use public cloud storage.

## Health check

With the app running, open:

```text
http://localhost:3000/api/health
```

For the current local setup you should see:

- `database: "ok"`
- `ai: true` after Gemini is configured
- `aiImageGeneration: true` after Cloudflare is configured
- `storage: true`
- `storageProvider: "local"`

Stripe, Meta, TikTok, X, and email may remain unconfigured while testing the core product.

## Troubleshooting

### Port 5433 is already in use

MarketPilot uses host port 5433 specifically to avoid clashing with a normal PostgreSQL installation on 5432.

Check Docker:

```powershell
docker ps
```

If another application also uses 5433, change the host port in `compose.yaml` and update `DATABASE_URL` / `DIRECT_URL` to match.

### Docker command is not found

Install Docker Desktop and reopen the terminal.

### Database schema is missing

Run:

```powershell
npm run db:local:setup
```

### Start from a completely fresh database

Run:

```powershell
npm run db:local:reset
```
