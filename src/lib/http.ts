import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

function isPrismaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as { code?: unknown; name?: unknown };
  return (
    (typeof candidate.code === 'string' && /^P\d{4}$/.test(candidate.code)) ||
    (typeof candidate.name === 'string' && candidate.name.startsWith('Prisma'))
  );
}

export function apiError(error: unknown, fallback = 'Request failed.') {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: 'Request body is not valid JSON.' }, { status: 400 });
  }

  if (isPrismaError(error)) {
    return NextResponse.json({ error: fallback }, { status: 500 });
  }

  const message = error instanceof Error ? error.message : fallback;

  const status =
    message === 'UNAUTHORIZED'
      ? 401
      : message === 'CAMPAIGN_NOT_FOUND' || message === 'BUSINESS_NOT_FOUND'
        ? 404
        : message === 'INSUFFICIENT_CREDITS'
          ? 402
          : 400;

  return NextResponse.json(
    { error: message === 'UNAUTHORIZED' ? 'Authentication required.' : message },
    { status },
  );
}
