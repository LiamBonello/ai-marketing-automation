import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { appUrl } from '@/lib/app-config';
import {
  completeConnectionAuthorization,
  type SocialProvider,
} from '@/lib/social-oauth';

function provider(value: string): SocialProvider {
  if (value === 'instagram' || value === 'x' || value === 'tiktok') return value;
  throw new Error('Unsupported social provider.');
}

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const destination = new URL('/business', appUrl());

  try {
    const auth = await getAuthContext();
    if (!auth) {
      destination.searchParams.set('connection', 'login_required');
      return NextResponse.redirect(destination);
    }

    const { provider: raw } = await context.params;
    const currentProvider = provider(raw);
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const oauthError = url.searchParams.get('error');

    if (oauthError) {
      destination.searchParams.set('connection', 'cancelled');
      destination.searchParams.set('provider', currentProvider);
      return NextResponse.redirect(destination);
    }

    if (!code || !state) throw new Error('OAuth callback is missing code or state.');

    await completeConnectionAuthorization({
      auth,
      provider: currentProvider,
      code,
      state,
    });

    destination.searchParams.set('connection', 'success');
    destination.searchParams.set('provider', currentProvider);
    return NextResponse.redirect(destination);
  } catch (error) {
    destination.searchParams.set('connection', 'error');
    destination.searchParams.set(
      'message',
      error instanceof Error ? error.message.slice(0, 160) : 'Connection failed.',
    );
    return NextResponse.redirect(destination);
  }
}
