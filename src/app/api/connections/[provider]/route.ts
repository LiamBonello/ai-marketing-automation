import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiError } from '@/lib/http';
import {
  disconnectProvider,
  type SocialProvider,
} from '@/lib/social-oauth';

function provider(value: string): SocialProvider {
  if (value === 'instagram' || value === 'x' || value === 'tiktok') return value;
  throw new Error('Unsupported social provider.');
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  try {
    const auth = await requireAuth();
    const { provider: raw } = await context.params;
    await disconnectProvider(auth, provider(raw));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
