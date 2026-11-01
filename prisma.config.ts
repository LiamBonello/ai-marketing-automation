import { existsSync, readFileSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;

  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const LOCAL_DATABASE_URL =
  'postgresql://marketpilot:marketpilot@127.0.0.1:5433/marketpilot';

function usableDatabaseUrl(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate || candidate.startsWith('REPLACE_ME_')) return null;

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'postgresql:' || parsed.protocol === 'postgres:'
      ? candidate
      : null;
  } catch {
    return null;
  }
}

function prismaDatabaseUrl(): string {
  const raw =
    usableDatabaseUrl(process.env.DIRECT_URL) ??
    usableDatabaseUrl(process.env.DATABASE_URL) ??
    LOCAL_DATABASE_URL;

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
