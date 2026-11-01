import { randomBytes } from 'node:crypto';
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

let source = await readExisting();

const fixedValues = {
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  MARKETPILOT_DEMO_MODE: 'false',
  DATABASE_URL: 'postgresql://marketpilot:marketpilot@127.0.0.1:5432/marketpilot',
  DIRECT_URL: 'postgresql://marketpilot:marketpilot@127.0.0.1:5432/marketpilot',
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
console.log('  PostgreSQL: postgresql://marketpilot:***@127.0.0.1:5432/marketpilot');
console.log('  Database schema: public');
console.log('  Media storage: local public/uploads');
console.log('  Existing Gemini/Cloudflare keys were preserved.');
console.log('  Missing local app secrets were generated automatically.');
