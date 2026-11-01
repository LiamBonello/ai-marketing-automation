import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env.local');
const examplePath = resolve(process.cwd(), '.env.example');

async function readExisting() {
  try {
    return await readFile(envPath, 'utf8');
  } catch {
    return readFile(examplePath, 'utf8');
  }
}

function currentValue(source, key) {
  const match = source.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match?.[1]?.trim() ?? '';
}

function setValue(source, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');

  if (pattern.test(source)) {
    return source.replace(pattern, line);
  }

  return `${source.trimEnd()}\n${line}\n`;
}

function needsSecret(value) {
  return !value || value.startsWith('REPLACE_ME_');
}

async function portAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, '127.0.0.1');
  });
}

async function chooseDatabasePort(source) {
  const configured = Number(currentValue(source, 'MARKETPILOT_DB_PORT'));

  if (
    Number.isInteger(configured) &&
    configured >= 1024 &&
    configured <= 65535 &&
    (await portAvailable(configured))
  ) {
    return configured;
  }

  for (let port = 55432; port <= 55550; port += 1) {
    if (await portAvailable(port)) return port;
  }

  throw new Error(
    'Could not find a free local TCP port between 55432 and 55550 for PostgreSQL.',
  );
}

let source = await readExisting();
const databasePort = await chooseDatabasePort(source);
const databaseUrl =
  `postgresql://marketpilot:marketpilot@127.0.0.1:${databasePort}/marketpilot`;

const fixedValues = {
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  MARKETPILOT_DEMO_MODE: 'false',
  MARKETPILOT_DB_PORT: String(databasePort),
  DATABASE_URL: databaseUrl,
  DIRECT_URL: databaseUrl,
  DATABASE_SCHEMA: 'public',
  DATABASE_POOL_MAX: '10',
  MEDIA_STORAGE: 'local',
  LOCAL_MEDIA_DIR: 'public/uploads',
};

for (const [key, value] of Object.entries(fixedValues)) {
  source = setValue(source, key, value);
}

for (const key of ['TOKEN_ENCRYPTION_KEY', 'CRON_SECRET', 'UNSUBSCRIBE_SECRET']) {
  const existing = currentValue(source, key);
  if (needsSecret(existing)) {
    source = setValue(source, key, randomBytes(32).toString('base64'));
  }
}

await writeFile(envPath, source.endsWith('\n') ? source : `${source}\n`, 'utf8');

console.log('MarketPilot local environment configured.');
console.log(
  `  PostgreSQL: postgresql://marketpilot:***@127.0.0.1:${databasePort}/marketpilot`,
);
console.log(`  Docker host port: ${databasePort}`);
console.log('  Database schema: public');
console.log('  Media storage: local public/uploads');
console.log('  Existing Gemini/Cloudflare keys were preserved.');
console.log('  Missing local app secrets were generated automatically.');
