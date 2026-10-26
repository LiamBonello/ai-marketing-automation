import { getDb } from '@/lib/db';
import { validAccessToken } from '@/lib/publisher';

type SupportedChannel = 'INSTAGRAM' | 'TIKTOK' | 'X';

interface MetricSnapshot {
  impressions: number;
  reach: number;
  clicks: number;
  engagements: number;
}

async function xMetrics(accessToken: string, postId: string): Promise<MetricSnapshot> {
  const url = new URL(`https://api.x.com/2/tweets/${postId}`);
  url.searchParams.set('tweet.fields', 'public_metrics');
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  const data = (await response.json()) as {
    data?: {
      public_metrics?: {
        impression_count?: number;
        like_count?: number;
        reply_count?: number;
        retweet_count?: number;
        quote_count?: number;
        bookmark_count?: number;
      };
    };
    detail?: string;
  };
  if (!response.ok || !data.data?.public_metrics) {
    throw new Error(data.detail || `X metrics request failed (${response.status}).`);
  }
  const metric = data.data.public_metrics;
  const engagements =
    (metric.like_count ?? 0) +
    (metric.reply_count ?? 0) +
    (metric.retweet_count ?? 0) +
    (metric.quote_count ?? 0) +
    (metric.bookmark_count ?? 0);

  return {
    impressions: metric.impression_count ?? 0,
    reach: 0,
    clicks: 0,
    engagements,
  };
}

async function instagramMetrics(
  accessToken: string,
  mediaId: string,
): Promise<MetricSnapshot> {
  const version = process.env.META_GRAPH_VERSION || 'v25.0';
  const url = new URL(`https://graph.instagram.com/${version}/${mediaId}`);
  url.searchParams.set('fields', 'like_count,comments_count');
  url.searchParams.set('access_token', accessToken);
  const response = await fetch(url, { cache: 'no-store' });
  const data = (await response.json()) as {
    like_count?: number;
    comments_count?: number;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(data.error?.message || `Instagram metrics request failed (${response.status}).`);
  }

  return {
    impressions: 0,
    reach: 0,
    clicks: 0,
    engagements: (data.like_count ?? 0) + (data.comments_count ?? 0),
  };
}

async function tiktokMetrics(
  accessToken: string,
  postId: string,
): Promise<MetricSnapshot | null> {
  if (!/^\d+$/.test(postId)) return null;

  const url =
    'https://open.tiktokapis.com/v2/video/query/?fields=id,view_count,like_count,comment_count,share_count';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filters: { video_ids: [postId] } }),
    cache: 'no-store',
  });
  const data = (await response.json()) as {
    data?: {
      videos?: Array<{
        id?: string;
        view_count?: number;
        like_count?: number;
        comment_count?: number;
        share_count?: number;
      }>;
    };
    error?: { code?: string; message?: string };
  };
  if (!response.ok || (data.error?.code && data.error.code !== 'ok')) {
    throw new Error(data.error?.message || `TikTok metrics request failed (${response.status}).`);
  }

  const video = data.data?.videos?.[0];
  if (!video) return null;

  return {
    impressions: video.view_count ?? 0,
    reach: 0,
    clicks: 0,
    engagements:
      (video.like_count ?? 0) +
      (video.comment_count ?? 0) +
      (video.share_count ?? 0),
  };
}

async function collectChannelMetric(input: {
  channel: SupportedChannel;
  externalPostId: string;
  accessToken: string;
}): Promise<MetricSnapshot | null> {
  if (input.channel === 'X') return xMetrics(input.accessToken, input.externalPostId);
  if (input.channel === 'INSTAGRAM') {
    return instagramMetrics(input.accessToken, input.externalPostId);
  }
  return tiktokMetrics(input.accessToken, input.externalPostId);
}

export async function ingestOrganicMetrics(limit = 50): Promise<{
  checked: number;
  stored: number;
  failed: number;
}> {
  const channels = await getDb().campaignChannel.findMany({
    where: {
      externalPostId: { not: null },
      channel: { in: ['INSTAGRAM', 'TIKTOK', 'X'] },
      campaign: { status: 'PUBLISHED' },
    },
    orderBy: { campaign: { publishedAt: 'desc' } },
    take: limit,
    include: {
      campaign: { select: { businessId: true } },
    },
  });

  let checked = 0;
  let stored = 0;
  let failed = 0;

  for (const channel of channels) {
    checked += 1;
    try {
      const connection = await getDb().socialConnection.findUnique({
        where: {
          businessId_channel: {
            businessId: channel.campaign.businessId,
            channel: channel.channel,
          },
        },
      });
      if (!connection || connection.status !== 'READY' || !channel.externalPostId) continue;

      const accessToken = await validAccessToken(connection);
      const metric = await collectChannelMetric({
        channel: channel.channel as SupportedChannel,
        externalPostId: channel.externalPostId,
        accessToken,
      });
      if (!metric) continue;

      await getDb().campaignMetric.create({
        data: {
          campaignId: channel.campaignId,
          channel: channel.channel,
          impressions: metric.impressions,
          reach: metric.reach,
          clicks: metric.clicks,
          engagements: metric.engagements,
        },
      });
      stored += 1;
    } catch {
      failed += 1;
    }
  }

  return { checked, stored, failed };
}
