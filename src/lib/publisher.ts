import { createHmac } from 'node:crypto';
import nodemailer from 'nodemailer';
import { appUrl, requireEnv } from '@/lib/app-config';
import { decryptSecret, encryptSecret } from '@/lib/crypto';
import { getDb } from '@/lib/db';

type Channel = 'INSTAGRAM' | 'TIKTOK' | 'X' | 'EMAIL';

export type ConnectionRecord = {
  id: string;
  channel: Channel;
  externalAccountId: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  tokenExpiresAt: Date | null;
  metadata: unknown;
};

async function saveTokens(
  connection: ConnectionRecord,
  input: { accessToken: string; refreshToken?: string; expiresIn?: number },
) {
  await getDb().socialConnection.update({
    where: { id: connection.id },
    data: {
      accessTokenEncrypted: encryptSecret(input.accessToken),
      refreshTokenEncrypted: input.refreshToken
        ? encryptSecret(input.refreshToken)
        : connection.refreshTokenEncrypted,
      tokenExpiresAt: input.expiresIn
        ? new Date(Date.now() + input.expiresIn * 1000)
        : connection.tokenExpiresAt,
      status: 'READY',
    },
  });
}

export async function validAccessToken(connection: ConnectionRecord): Promise<string> {
  const accessToken = decryptSecret(connection.accessTokenEncrypted);
  if (!connection.tokenExpiresAt || connection.tokenExpiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
    return accessToken;
  }

  if (connection.channel === 'INSTAGRAM') {
    const url = new URL('https://graph.instagram.com/refresh_access_token');
    url.searchParams.set('grant_type', 'ig_refresh_token');
    url.searchParams.set('access_token', accessToken);
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Instagram token refresh failed (${response.status}).`);
    const data = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) throw new Error('Instagram refresh did not return a token.');
    await saveTokens(connection, { accessToken: data.access_token, expiresIn: data.expires_in });
    return data.access_token;
  }

  const refreshToken = connection.refreshTokenEncrypted
    ? decryptSecret(connection.refreshTokenEncrypted)
    : null;
  if (!refreshToken) throw new Error(`${connection.channel} connection requires reauthorization.`);

  if (connection.channel === 'X') {
    const credentials = Buffer.from(
      `${requireEnv('X_CLIENT_ID')}:${requireEnv('X_CLIENT_SECRET')}`,
    ).toString('base64');
    const response = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`X token refresh failed (${response.status}).`);
    const data = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) throw new Error('X refresh did not return a token.');
    await saveTokens(connection, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    });
    return data.access_token;
  }

  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: requireEnv('TIKTOK_CLIENT_KEY'),
      client_secret: requireEnv('TIKTOK_CLIENT_SECRET'),
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`TikTok token refresh failed (${response.status}).`);
  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) throw new Error('TikTok refresh did not return a token.');
  await saveTokens(connection, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  });
  return data.access_token;
}

async function publishX(accessToken: string, copy: string): Promise<string> {
  const response = await fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: copy.slice(0, 280) }),
  });
  const data = (await response.json()) as {
    data?: { id?: string };
    detail?: string;
    title?: string;
  };
  if (!response.ok || !data.data?.id) {
    throw new Error(`X publishing failed: ${data.detail || data.title || response.status}.`);
  }
  return data.data.id;
}

function isVideo(url: string): boolean {
  const path = new URL(url).pathname.toLowerCase();
  return ['.mp4', '.mov', '.webm'].some((extension) => path.endsWith(extension));
}

async function waitForInstagramContainer(
  containerId: string,
  accessToken: string,
  version: string,
): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const url = new URL(`https://graph.instagram.com/${version}/${containerId}`);
    url.searchParams.set('fields', 'status_code');
    url.searchParams.set('access_token', accessToken);
    const response = await fetch(url, { cache: 'no-store' });
    const data = (await response.json()) as { status_code?: string; error?: { message?: string } };
    if (!response.ok) throw new Error(data.error?.message || 'Instagram media processing failed.');
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
      throw new Error(`Instagram media processing ended with ${data.status_code}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error('Instagram media processing timed out.');
}

async function publishInstagram(
  connection: ConnectionRecord,
  accessToken: string,
  copy: string,
  mediaUrl: string | null,
): Promise<string> {
  if (!mediaUrl) throw new Error('Instagram requires an image or video.');

  const version = process.env.META_GRAPH_VERSION || 'v25.0';
  const createUrl = new URL(
    `https://graph.instagram.com/${version}/${connection.externalAccountId}/media`,
  );
  const body = new URLSearchParams({
    access_token: accessToken,
    caption: copy,
  });
  if (isVideo(mediaUrl)) {
    body.set('media_type', 'REELS');
    body.set('video_url', mediaUrl);
  } else {
    body.set('image_url', mediaUrl);
  }

  const createResponse = await fetch(createUrl, { method: 'POST', body, cache: 'no-store' });
  const createData = (await createResponse.json()) as {
    id?: string;
    error?: { message?: string };
  };
  if (!createResponse.ok || !createData.id) {
    throw new Error(createData.error?.message || `Instagram media creation failed (${createResponse.status}).`);
  }

  await waitForInstagramContainer(createData.id, accessToken, version);

  const publishUrl = new URL(
    `https://graph.instagram.com/${version}/${connection.externalAccountId}/media_publish`,
  );
  const publishResponse = await fetch(publishUrl, {
    method: 'POST',
    body: new URLSearchParams({
      access_token: accessToken,
      creation_id: createData.id,
    }),
    cache: 'no-store',
  });
  const publishData = (await publishResponse.json()) as {
    id?: string;
    error?: { message?: string };
  };
  if (!publishResponse.ok || !publishData.id) {
    throw new Error(publishData.error?.message || `Instagram publish failed (${publishResponse.status}).`);
  }
  return publishData.id;
}

async function tiktokCreatorInfo(accessToken: string) {
  const response = await fetch(
    'https://open.tiktokapis.com/v2/post/publish/creator_info/query/',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: '{}',
      cache: 'no-store',
    },
  );
  const data = (await response.json()) as {
    data?: {
      privacy_level_options?: string[];
      comment_disabled?: boolean;
      duet_disabled?: boolean;
      stitch_disabled?: boolean;
    };
    error?: { code?: string; message?: string };
  };
  if (!response.ok || data.error?.code !== 'ok') {
    throw new Error(data.error?.message || `TikTok creator-info request failed (${response.status}).`);
  }
  return {
    privacyOptions: data.data?.privacy_level_options || [],
    commentDisabled: Boolean(data.data?.comment_disabled),
    duetDisabled: Boolean(data.data?.duet_disabled),
    stitchDisabled: Boolean(data.data?.stitch_disabled),
  };
}

async function publishTikTok(
  accessToken: string,
  copy: string,
  mediaUrl: string | null,
  rawSettings: unknown,
): Promise<string> {
  if (!mediaUrl) throw new Error('TikTok requires an image or video.');

  const settings =
    rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings)
      ? (rawSettings as Record<string, unknown>)
      : {};
  const privacyLevel =
    typeof settings.privacyLevel === 'string' ? settings.privacyLevel : null;
  const consentAt = typeof settings.consentAt === 'string' ? settings.consentAt : null;
  if (!privacyLevel || !consentAt) {
    throw new Error('TikTok publishing settings and explicit consent are required.');
  }

  const creator = await tiktokCreatorInfo(accessToken);
  if (!creator.privacyOptions.includes(privacyLevel)) {
    throw new Error('The saved TikTok privacy option is no longer available. Review TikTok settings again.');
  }

  const allowComment = settings.allowComment === true && !creator.commentDisabled;
  const allowDuet = settings.allowDuet === true && !creator.duetDisabled;
  const allowStitch = settings.allowStitch === true && !creator.stitchDisabled;

  const video = isVideo(mediaUrl);
  const endpoint = video
    ? 'https://open.tiktokapis.com/v2/post/publish/video/init/'
    : 'https://open.tiktokapis.com/v2/post/publish/content/init/';

  const payload = video
    ? {
        post_info: {
          title: copy.slice(0, 2200),
          privacy_level: privacyLevel,
          disable_comment: !allowComment,
          disable_duet: !allowDuet,
          disable_stitch: !allowStitch,
          brand_organic_toggle: true,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: mediaUrl,
        },
      }
    : {
        post_info: {
          title: copy.slice(0, 90),
          description: copy.slice(0, 2200),
          privacy_level: privacyLevel,
          disable_comment: !allowComment,
          auto_add_music: true,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          photo_cover_index: 0,
          photo_images: [mediaUrl],
        },
        post_mode: 'DIRECT_POST',
        media_type: 'PHOTO',
      };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const data = (await response.json()) as {
    data?: { publish_id?: string };
    error?: { code?: string; message?: string };
  };
  if (!response.ok || data.error?.code !== 'ok' || !data.data?.publish_id) {
    throw new Error(data.error?.message || `TikTok publishing failed (${response.status}).`);
  }

  const publishId = data.data.publish_id;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const statusResponse = await fetch(
      'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({ publish_id: publishId }),
        cache: 'no-store',
      },
    );
    const statusData = (await statusResponse.json()) as {
      data?: {
        status?: string;
        fail_reason?: string;
        publicaly_available_post_id?: Array<string | number>;
      };
      error?: { code?: string; message?: string };
    };

    if (!statusResponse.ok || statusData.error?.code !== 'ok') {
      throw new Error(
        statusData.error?.message || `TikTok status check failed (${statusResponse.status}).`,
      );
    }

    if (statusData.data?.status === 'FAILED') {
      throw new Error(statusData.data.fail_reason || 'TikTok post processing failed.');
    }

    if (statusData.data?.status === 'PUBLISH_COMPLETE') {
      return String(statusData.data.publicaly_available_post_id?.[0] || publishId);
    }
  }

  throw new Error(
    'TikTok accepted the post but processing did not finish within one minute. The job will retry.',
  );
}

function unsubscribeToken(contactId: string): string {
  return createHmac('sha256', requireEnv('UNSUBSCRIBE_SECRET'))
    .update(contactId)
    .digest('base64url');
}

export function verifyUnsubscribeToken(contactId: string, token: string): boolean {
  return unsubscribeToken(contactId) === token;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return entities[character] || character;
  });
}

function mailTransport() {
  return nodemailer.createTransport({
    host: requireEnv('SMTP_HOST'),
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: requireEnv('SMTP_PASSWORD') }
      : undefined,
  });
}

async function publishEmail(input: {
  businessId: string;
  subject: string | null;
  copy: string;
}): Promise<string> {
  const contacts = await getDb().contact.findMany({
    where: { businessId: input.businessId, status: 'SUBSCRIBED' },
    select: { id: true, email: true, firstName: true },
  });
  if (contacts.length === 0) throw new Error('No subscribed email contacts are available.');

  const transport = mailTransport();
  const from = requireEnv('SMTP_FROM');
  const subject = input.subject || 'Latest update';
  let delivered = 0;

  for (let index = 0; index < contacts.length; index += 10) {
    const group = contacts.slice(index, index + 10);
    const results = await Promise.allSettled(
      group.map((contact) => {
        const unsubscribeUrl = new URL('/api/email/unsubscribe', appUrl());
        unsubscribeUrl.searchParams.set('contact', contact.id);
        unsubscribeUrl.searchParams.set('token', unsubscribeToken(contact.id));
        const greeting = contact.firstName ? `Hi ${contact.firstName},\n\n` : '';
        const text = `${greeting}${input.copy}\n\nUnsubscribe: ${unsubscribeUrl.toString()}`;
        const html = `<p>${escapeHtml(greeting + input.copy).replace(/\n/g, '<br>')}</p><p><a href="${unsubscribeUrl.toString()}">Unsubscribe</a></p>`;
        return transport.sendMail({
          from,
          to: contact.email,
          subject,
          text,
          html,
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl.toString()}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        });
      }),
    );
    delivered += results.filter((result) => result.status === 'fulfilled').length;
  }

  if (delivered === 0) throw new Error('Email delivery failed for all subscribed contacts.');
  return `email:${delivered}`;
}

async function publishJob(jobId: string): Promise<void> {
  const job = await getDb().publishJob.findUnique({
    where: { id: jobId },
    include: {
      campaign: {
        include: {
          business: true,
          channels: true,
        },
      },
    },
  });
  if (!job || job.status !== 'PROCESSING') return;

  const channel = job.campaign.channels.find((item) => item.channel === job.channel);
  if (!channel || !channel.enabled) throw new Error('Publish channel is no longer enabled.');

  const copy = channel.variantCopy || '';
  let externalId: string;

  if (job.channel === 'EMAIL') {
    externalId = await publishEmail({
      businessId: job.campaign.businessId,
      subject: channel.subject,
      copy,
    });
  } else {
    const connection = await getDb().socialConnection.findUnique({
      where: {
        businessId_channel: {
          businessId: job.campaign.businessId,
          channel: job.channel,
        },
      },
    });
    if (!connection || connection.status !== 'READY') {
      throw new Error(`${job.channel} is not connected or requires attention.`);
    }

    const token = await validAccessToken(connection);
    if (job.channel === 'X') {
      externalId = await publishX(token, copy);
    } else if (job.channel === 'INSTAGRAM') {
      externalId = await publishInstagram(connection, token, copy, channel.mediaUrl);
    } else {
      externalId = await publishTikTok(token, copy, channel.mediaUrl, channel.metadata);
    }
  }

  await getDb().$transaction([
    getDb().publishJob.update({
      where: { id: job.id },
      data: {
        status: 'SUCCEEDED',
        externalId,
        completedAt: new Date(),
        lastError: null,
      },
    }),
    getDb().campaignChannel.update({
      where: {
        campaignId_channel: {
          campaignId: job.campaignId,
          channel: job.channel,
        },
      },
      data: { externalPostId: externalId },
    }),
  ]);
}

async function finalizeCampaign(campaignId: string): Promise<void> {
  const jobs = await getDb().publishJob.findMany({
    where: { campaignId },
    select: { status: true },
  });
  if (jobs.some((job) => job.status === 'PENDING' || job.status === 'PROCESSING')) return;

  const failed = jobs.some((job) => job.status === 'FAILED');
  await getDb().campaign.update({
    where: { id: campaignId },
    data: failed
      ? { status: 'FAILED', lastError: 'One or more channels failed to publish.' }
      : { status: 'PUBLISHED', publishedAt: new Date(), lastError: null },
  });
}

export async function processDuePublishJobs(limit = 20): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  while (processed < limit) {
    const next = await getDb().publishJob.findFirst({
      where: { status: 'PENDING', scheduledFor: { lte: new Date() } },
      orderBy: { scheduledFor: 'asc' },
      select: { id: true, campaignId: true, attempts: true },
    });
    if (!next) break;

    const claimed = await getDb().publishJob.updateMany({
      where: { id: next.id, status: 'PENDING' },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        startedAt: new Date(),
      },
    });
    if (claimed.count !== 1) continue;

    await getDb().campaign.updateMany({
      where: { id: next.campaignId, status: { in: ['SCHEDULED', 'APPROVED'] } },
      data: { status: 'PUBLISHING' },
    });

    processed += 1;
    try {
      await publishJob(next.id);
      succeeded += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : 'Unknown publish error.';
      const attemptNumber = next.attempts + 1;
      const retry = attemptNumber < 3;
      await getDb().publishJob.update({
        where: { id: next.id },
        data: retry
          ? {
              status: 'PENDING',
              scheduledFor: new Date(Date.now() + 5 * 60 * 1000 * 2 ** (attemptNumber - 1)),
              lastError: message.slice(0, 1000),
            }
          : {
              status: 'FAILED',
              completedAt: new Date(),
              lastError: message.slice(0, 1000),
            },
      });
    }

    await finalizeCampaign(next.campaignId);
  }

  return { processed, succeeded, failed };
}
