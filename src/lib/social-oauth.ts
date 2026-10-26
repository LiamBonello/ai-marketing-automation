import { createHash } from 'node:crypto';
import type { AuthContext } from '@/lib/auth';
import { appUrl, requireEnv } from '@/lib/app-config';
import { decryptSecret, encryptSecret, secureToken, sha256 } from '@/lib/crypto';
import { getDb } from '@/lib/db';

export type SocialProvider = 'instagram' | 'x' | 'tiktok';

function channelFor(provider: SocialProvider) {
  if (provider === 'instagram') return 'INSTAGRAM' as const;
  if (provider === 'tiktok') return 'TIKTOK' as const;
  return 'X' as const;
}

function redirectUri(provider: SocialProvider): string {
  return `${appUrl()}/api/connections/${provider}/callback`;
}

function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export async function createConnectionAuthorization(
  auth: AuthContext,
  provider: SocialProvider,
): Promise<string> {
  const state = secureToken(32);
  const verifier = provider === 'x' ? secureToken(48) : null;

  await getDb().oAuthState.create({
    data: {
      provider,
      stateHash: sha256(state),
      codeVerifierEncrypted: verifier ? encryptSecret(verifier) : null,
      userId: auth.userId,
      businessId: auth.businessId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      metadata: { redirectUri: redirectUri(provider) },
    },
  });

  if (provider === 'instagram') {
    const url = new URL('https://www.instagram.com/oauth/authorize');
    url.searchParams.set('client_id', requireEnv('META_APP_ID'));
    url.searchParams.set('redirect_uri', redirectUri(provider));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set(
      'scope',
      process.env.META_SCOPES ||
        'instagram_business_basic,instagram_business_content_publish',
    );
    url.searchParams.set('state', state);
    return url.toString();
  }

  if (provider === 'x') {
    const url = new URL('https://x.com/i/oauth2/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', requireEnv('X_CLIENT_ID'));
    url.searchParams.set('redirect_uri', redirectUri(provider));
    url.searchParams.set(
      'scope',
      process.env.X_SCOPES || 'tweet.read tweet.write users.read offline.access',
    );
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', pkceChallenge(verifier!));
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
  url.searchParams.set('client_key', requireEnv('TIKTOK_CLIENT_KEY'));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set(
    'scope',
    process.env.TIKTOK_SCOPES || 'user.info.basic,video.publish,video.upload',
  );
  url.searchParams.set('redirect_uri', redirectUri(provider));
  url.searchParams.set('state', state);
  return url.toString();
}

interface TokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scopes?: string;
  externalAccountId: string;
  displayName?: string;
  metadata?: Record<string, unknown>;
}

async function exchangeInstagram(code: string): Promise<TokenResult> {
  const body = new URLSearchParams({
    client_id: requireEnv('META_APP_ID'),
    client_secret: requireEnv('META_APP_SECRET'),
    grant_type: 'authorization_code',
    redirect_uri: redirectUri('instagram'),
    code,
  });

  const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  if (!tokenResponse.ok) throw new Error(`Instagram token exchange failed (${tokenResponse.status}).`);

  const shortToken = (await tokenResponse.json()) as {
    access_token?: string;
    user_id?: string | number;
  };
  if (!shortToken.access_token) throw new Error('Instagram did not return an access token.');

  const longUrl = new URL('https://graph.instagram.com/access_token');
  longUrl.searchParams.set('grant_type', 'ig_exchange_token');
  longUrl.searchParams.set('client_secret', requireEnv('META_APP_SECRET'));
  longUrl.searchParams.set('access_token', shortToken.access_token);

  const longResponse = await fetch(longUrl, { cache: 'no-store' });
  if (!longResponse.ok) throw new Error(`Instagram long-lived token exchange failed (${longResponse.status}).`);
  const longToken = (await longResponse.json()) as { access_token?: string; expires_in?: number };
  const accessToken = longToken.access_token || shortToken.access_token;

  const version = process.env.META_GRAPH_VERSION || 'v25.0';
  const meUrl = new URL(`https://graph.instagram.com/${version}/me`);
  meUrl.searchParams.set('fields', 'user_id,username');
  meUrl.searchParams.set('access_token', accessToken);
  const meResponse = await fetch(meUrl, { cache: 'no-store' });
  if (!meResponse.ok) throw new Error(`Instagram profile request failed (${meResponse.status}).`);
  const me = (await meResponse.json()) as {
    id?: string;
    user_id?: string | number;
    username?: string;
  };

  return {
    accessToken,
    expiresIn: longToken.expires_in,
    externalAccountId: String(me.user_id || me.id || shortToken.user_id || ''),
    displayName: me.username,
  };
}

async function exchangeX(code: string, verifier: string): Promise<TokenResult> {
  const credentials = Buffer.from(
    `${requireEnv('X_CLIENT_ID')}:${requireEnv('X_CLIENT_SECRET')}`,
  ).toString('base64');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri('x'),
    code_verifier: verifier,
  });
  const tokenResponse = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    cache: 'no-store',
  });
  if (!tokenResponse.ok) throw new Error(`X token exchange failed (${tokenResponse.status}).`);
  const token = (await tokenResponse.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!token.access_token) throw new Error('X did not return an access token.');

  const meResponse = await fetch(
    'https://api.x.com/2/users/me?user.fields=id,name,username,profile_image_url',
    {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: 'no-store',
    },
  );
  if (!meResponse.ok) throw new Error(`X profile request failed (${meResponse.status}).`);
  const me = (await meResponse.json()) as {
    data?: { id?: string; name?: string; username?: string; profile_image_url?: string };
  };
  if (!me.data?.id) throw new Error('X did not return an account identifier.');

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresIn: token.expires_in,
    scopes: token.scope,
    externalAccountId: me.data.id,
    displayName: me.data.username || me.data.name,
    metadata: { profileImageUrl: me.data.profile_image_url },
  };
}

async function exchangeTikTok(code: string): Promise<TokenResult> {
  const body = new URLSearchParams({
    client_key: requireEnv('TIKTOK_CLIENT_KEY'),
    client_secret: requireEnv('TIKTOK_CLIENT_SECRET'),
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri('tiktok'),
  });

  const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  if (!tokenResponse.ok) throw new Error(`TikTok token exchange failed (${tokenResponse.status}).`);
  const token = (await tokenResponse.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    open_id?: string;
  };
  if (!token.access_token || !token.open_id) throw new Error('TikTok did not return a valid access token.');

  const meResponse = await fetch(
    'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url',
    {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: 'no-store',
    },
  );
  if (!meResponse.ok) throw new Error(`TikTok profile request failed (${meResponse.status}).`);
  const me = (await meResponse.json()) as {
    data?: { user?: { open_id?: string; display_name?: string; avatar_url?: string } };
  };

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresIn: token.expires_in,
    scopes: token.scope,
    externalAccountId: me.data?.user?.open_id || token.open_id,
    displayName: me.data?.user?.display_name,
    metadata: { avatarUrl: me.data?.user?.avatar_url },
  };
}

export async function completeConnectionAuthorization(input: {
  auth: AuthContext;
  provider: SocialProvider;
  state: string;
  code: string;
}): Promise<void> {
  const stateRecord = await getDb().oAuthState.findUnique({
    where: { stateHash: sha256(input.state) },
  });

  if (
    !stateRecord ||
    stateRecord.provider !== input.provider ||
    stateRecord.userId !== input.auth.userId ||
    stateRecord.businessId !== input.auth.businessId ||
    stateRecord.expiresAt <= new Date()
  ) {
    throw new Error('OAuth state is invalid or expired.');
  }

  const verifier = stateRecord.codeVerifierEncrypted
    ? decryptSecret(stateRecord.codeVerifierEncrypted)
    : null;

  const result =
    input.provider === 'instagram'
      ? await exchangeInstagram(input.code)
      : input.provider === 'x'
        ? await exchangeX(input.code, verifier || '')
        : await exchangeTikTok(input.code);

  if (!result.externalAccountId) throw new Error('Provider account identifier is missing.');

  await getDb().$transaction(async (tx) => {
    await tx.socialConnection.upsert({
      where: {
        businessId_channel: {
          businessId: input.auth.businessId,
          channel: channelFor(input.provider),
        },
      },
      create: {
        businessId: input.auth.businessId,
        channel: channelFor(input.provider),
        externalAccountId: result.externalAccountId,
        displayName: result.displayName,
        accessTokenEncrypted: encryptSecret(result.accessToken),
        refreshTokenEncrypted: result.refreshToken ? encryptSecret(result.refreshToken) : null,
        tokenExpiresAt: result.expiresIn
          ? new Date(Date.now() + result.expiresIn * 1000)
          : null,
        scopes: result.scopes,
        status: 'READY',
        metadata: result.metadata,
      },
      update: {
        externalAccountId: result.externalAccountId,
        displayName: result.displayName,
        accessTokenEncrypted: encryptSecret(result.accessToken),
        refreshTokenEncrypted: result.refreshToken ? encryptSecret(result.refreshToken) : null,
        tokenExpiresAt: result.expiresIn
          ? new Date(Date.now() + result.expiresIn * 1000)
          : null,
        scopes: result.scopes,
        status: 'READY',
        metadata: result.metadata,
      },
    });

    await tx.oAuthState.delete({ where: { id: stateRecord.id } });
  });
}

export async function disconnectProvider(
  auth: AuthContext,
  provider: SocialProvider,
): Promise<void> {
  await getDb().socialConnection.deleteMany({
    where: {
      businessId: auth.businessId,
      channel: channelFor(provider),
    },
  });
}
