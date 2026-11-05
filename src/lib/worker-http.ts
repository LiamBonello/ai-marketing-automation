import { NextResponse } from 'next/server';

type ErrorWithCode = {
  code?: unknown;
  cause?: unknown;
};

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;

  const candidate = error as ErrorWithCode;
  if (typeof candidate.code === 'string') return candidate.code;

  return errorCode(candidate.cause);
}

function databaseTarget() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return { kind: 'missing' };

  try {
    const url = new URL(connectionString);
    const hostname = url.hostname.toLowerCase();

    const kind = hostname.endsWith('.pooler.supabase.com')
      ? 'supabase_pooler'
      : hostname.startsWith('db.') && hostname.endsWith('.supabase.co')
        ? 'supabase_direct'
        : 'other';

    return {
      kind,
      port: url.port || 'default',
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
      databaseTarget: databaseTarget(),
    },
    { status: 500 },
  );
}
