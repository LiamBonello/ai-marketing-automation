import { NextResponse } from 'next/server';
import { safeEqual } from '@/lib/crypto';

function authorized(request: Request): boolean {
  const configured = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization') || '';
  const provided = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  return Boolean(configured && provided && safeEqual(provided, configured));
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const cloudflareToken = process.env.CLOUDFLARE_AI_API_TOKEN;
  const configuredModel = process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell';

  let gemini = 'not_configured';
  if (geminiKey) {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
      headers: { 'x-goog-api-key': geminiKey },
      cache: 'no-store',
    });
    gemini = response.ok ? 'ok' : `http_${response.status}`;
  }

  let cloudflare = 'not_configured';
  if (accountId && cloudflareToken) {
    const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/models/search`);
    url.searchParams.set('search', configuredModel.split('/').at(-1) || configuredModel);
    url.searchParams.set('per_page', '5');

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${cloudflareToken}` },
      cache: 'no-store',
    });
    cloudflare = response.ok ? 'ok' : `http_${response.status}`;
  }

  return NextResponse.json({ gemini, cloudflare });
}
