import { NextResponse } from 'next/server';
import { safeEqual } from '@/lib/crypto';
import { ingestOrganicMetrics } from '@/lib/metrics';

export async function POST(request: Request) {
  const configured = process.env.CRON_SECRET;
  if (!configured) return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });

  const authorization = request.headers.get('authorization') || '';
  const provided = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!provided || !safeEqual(provided, configured)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  return NextResponse.json(await ingestOrganicMetrics());
}
