import { NextResponse } from 'next/server';
import { processDuePublishJobs } from '@/lib/publisher';
import { safeEqual } from '@/lib/crypto';
import { workerFailureResponse } from '@/lib/worker-http';

export async function POST(request: Request) {
  const configured = process.env.CRON_SECRET;
  if (!configured) return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });

  const authorization = request.headers.get('authorization') || '';
  const provided = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!provided || !safeEqual(provided, configured)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const result = await processDuePublishJobs();
    return NextResponse.json(result);
  } catch (error) {
    return workerFailureResponse(error);
  }
}
