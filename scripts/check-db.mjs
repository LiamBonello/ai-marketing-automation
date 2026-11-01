import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';

function loadEnv(path) {
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
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv('.env.local');
loadEnv('.env');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is missing from .env.local');
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(connectionString);
} catch {
  console.error('DATABASE_URL is not a valid PostgreSQL URL.');
  process.exit(1);
}

console.log('Checking MarketPilot PostgreSQL...');
console.log(`  Host: ${parsed.hostname}`);
console.log(`  Port: ${parsed.port || '5432'}`);
console.log(`  Database: ${parsed.pathname.replace(/^\//, '')}`);
console.log(`  User: ${decodeURIComponent(parsed.username)}`);

const pool = new pg.Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 5000,
});

try {
  const result = await pool.query(
    'select version(), current_database() as database, current_user as user_name, current_schema() as schema_name',
  );
  const row = result.rows[0];
  console.log('Connection: OK');
  console.log(`  Database: ${row.database}`);
  console.log(`  User: ${row.user_name}`);
  console.log(`  Schema: ${row.schema_name}`);
  console.log(`  Server: ${String(row.version).split(',')[0]}`);
} catch (error) {
  console.error('Connection: FAILED');
  console.error(error instanceof Error ? error.message : String(error));
  console.error('');
  console.error('Also run:');
  console.error('  docker compose ps');
  console.error('  docker compose logs postgres --tail 80');
  process.exitCode = 1;
} finally {
  await pool.end();
}
