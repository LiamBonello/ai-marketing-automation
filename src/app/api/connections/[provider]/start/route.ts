import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiError } from '@/lib/http';
import {
  createConnectionAuthorization,
  type SocialProvider,
} from '@/lib/social-oauth';

function provider(value: string): SocialProvider {
  if (value === 'instagram' || value === 'x' || value === 'tiktok') return value;
  throw new Error('Unsupported social provider.');
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  try {
    const auth = await requireAuth();
    const { provider: raw } = await context.params;
    const url = await createConnectionAuthorization(auth, provider(raw));
    return NextResponse.redirect(url);
  } catch (error) {
    return apiError(error);
  }
}
