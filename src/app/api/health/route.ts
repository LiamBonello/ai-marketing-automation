import { NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/app-config';
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
        ai: Boolean(process.env.GEMINI_API_KEY),
        aiProvider: process.env.GEMINI_API_KEY ? 'gemini' : 'not_configured',
        aiImageGeneration: false,
        stripe: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
        storage: Boolean(
          process.env.S3_BUCKET &&
          process.env.S3_ACCESS_KEY_ID &&
          process.env.S3_SECRET_ACCESS_KEY &&
          process.env.S3_PUBLIC_BASE_URL
        ),
        instagram: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
        x: Boolean(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET),
        tiktok: Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET),
        email: Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM),
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
