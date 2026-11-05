import { NextResponse } from 'next/server';

type ErrorWithCode = {
  code?: unknown;
  cause?: unknown;
  name?: unknown;
  message?: unknown;
};

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;

  const candidate = error as ErrorWithCode;
  if (typeof candidate.code === 'string') return candidate.code;

  return errorCode(candidate.cause);
}

function errorName(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;

  const candidate = error as ErrorWithCode;
  if (typeof candidate.name === 'string') return candidate.name;

  return errorName(candidate.cause);
}

function sanitizeErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;

  const candidate = error as ErrorWithCode;
  const message =
    typeof candidate.message === 'string'
      ? candidate.message
      : candidate.cause
        ? sanitizeErrorMessage(candidate.cause)
        : undefined;

  if (!message) return undefined;

  return message
    .replace(/postgres(?:ql)?:\/\/[^\s@]+@/gi, 'postgresql://***@')
    .replace(/password=[^\s&]+/gi, 'password=***')
    .replace(/user=[^\s&]+/gi, 'user=***')
    .slice(0, 240);
}

function databaseTarget() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return { kind: 'missing' };

  try {
    const url = new URL(connectionString);
    const hostname = url.hostname.toLowerCase();

    const isSupabasePooler = hostname.endsWith('.pooler.supabase.com');
    const kind = isSupabasePooler
      ? 'supabase_pooler'
      : hostname.startsWith('db.') && hostname.endsWith('.supabase.co')
        ? 'supabase_direct'
        : 'other';

    return {
      kind,
      port: url.port || 'default',
      usernameKind:
        isSupabasePooler && /^postgres\.[a-z0-9]+$/i.test(decodeURIComponent(url.username))
          ? 'supabase_shared_pooler'
          : decodeURIComponent(url.username) === 'postgres'
            ? 'postgres'
            : 'other',
      sslmode: url.searchParams.get('sslmode') || 'unset',
      pgbouncer: url.searchParams.get('pgbouncer') === 'true',
      connectionLimit: url.searchParams.get('connection_limit') || 'unset',
    };
  } catch {
    return { kind: 'invalid' };
  }
}

export function workerFailureResponse(error: unknown) {
  const code = errorCode(error);

  const diagnostic =
    code === '28P01' || code === 'P1000'
      ? 'DATABASE_AUTH_FAILED'
      : code === '3D000'
        ? 'DATABASE_NOT_FOUND'
        : code === 'ENOTFOUND' || code === 'EAI_AGAIN'
          ? 'DATABASE_DNS_FAILED'
          : code === 'ECONNREFUSED'
            ? 'DATABASE_CONNECTION_REFUSED'
            : code === 'ETIMEDOUT' || code === 'P1001'
              ? 'DATABASE_UNREACHABLE'
              : code === 'ERR_INVALID_URL' || code === 'P1013'
                ? 'DATABASE_URL_INVALID'
                : code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
                    code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
                    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
                  ? 'DATABASE_TLS_FAILED'
                  : 'WORKER_FAILED';

  return NextResponse.json(
    {
      error: 'Worker failed.',
      code: diagnostic,
      errorCode: code || 'unknown',
      errorName: errorName(error) || 'unknown',
      message: sanitizeErrorMessage(error) || 'Unavailable.',
      databaseTarget: databaseTarget(),
    },
    { status: 500 },
  );
}
