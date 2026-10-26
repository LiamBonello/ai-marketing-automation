import { NextResponse } from 'next/server';
import { hasConfiguredEnv, isDemoMode } from '@/lib/app-config';
import { getDb } from '@/lib/db';

export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json({
      status: 'ok',
      mode: 'demo',
      database: 'skipped',
    });
  }

  try {
    await getDb().$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'ok',
      mode: 'live',
      database: 'ok',
      integrations: {
        ai: hasConfiguredEnv('GEMINI_API_KEY'),
        aiProvider: hasConfiguredEnv('GEMINI_API_KEY') ? 'gemini' : 'not_configured',
        aiImageGeneration: hasConfiguredEnv('CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_AI_API_TOKEN'),
        stripe: hasConfiguredEnv('STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'),
        storage: hasConfiguredEnv('S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PUBLIC_BASE_URL'),
        instagram: hasConfiguredEnv('META_APP_ID', 'META_APP_SECRET'),
        x: hasConfiguredEnv('X_CLIENT_ID', 'X_CLIENT_SECRET'),
        tiktok: hasConfiguredEnv('TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'),
        email: hasConfiguredEnv('SMTP_HOST', 'SMTP_FROM'),
      },
    });
  } catch {
    return NextResponse.json(
      {
        status: 'degraded',
        mode: 'live',
        database: 'unavailable',
      },
      { status: 503 },
    );
  }
}
