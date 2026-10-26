import { defineConfig } from 'prisma/config';

function prismaDatabaseUrl(): string {
  const raw =
    process.env.DIRECT_URL ??
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@127.0.0.1:5432/marketpilot';

  const url = new URL(raw);
  url.searchParams.set('schema', process.env.DATABASE_SCHEMA || 'public');
  return url.toString();
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: prismaDatabaseUrl(),
  },
});
