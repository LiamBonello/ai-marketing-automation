import { NextResponse } from 'next/server';

export function apiError(error: unknown, fallback = 'Request failed.') {
  const message = error instanceof Error ? error.message : fallback;

  const status =
    message === 'UNAUTHORIZED'
      ? 401
      : message === 'CAMPAIGN_NOT_FOUND' || message === 'BUSINESS_NOT_FOUND'
        ? 404
        : message === 'INSUFFICIENT_CREDITS'
          ? 402
          : 400;

  return NextResponse.json({ error: message }, { status });
}
