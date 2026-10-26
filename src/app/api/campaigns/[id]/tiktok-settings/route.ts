import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/http';
import { validAccessToken } from '@/lib/publisher';

interface CreatorInfo {
  creatorNickname: string;
  privacyLevelOptions: string[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoPostDurationSec: number | null;
}

async function creatorInfo(accessToken: string): Promise<CreatorInfo> {
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
      creator_nickname?: string;
      privacy_level_options?: string[];
      comment_disabled?: boolean;
      duet_disabled?: boolean;
      stitch_disabled?: boolean;
      max_video_post_duration_sec?: number;
    };
    error?: { code?: string; message?: string };
  };

  if (!response.ok || data.error?.code !== 'ok') {
    throw new Error(
      data.error?.message || `TikTok creator-info request failed (${response.status}).`,
    );
  }

  return {
    creatorNickname: data.data?.creator_nickname || 'TikTok creator',
    privacyLevelOptions: data.data?.privacy_level_options || [],
    commentDisabled: Boolean(data.data?.comment_disabled),
    duetDisabled: Boolean(data.data?.duet_disabled),
    stitchDisabled: Boolean(data.data?.stitch_disabled),
    maxVideoPostDurationSec: data.data?.max_video_post_duration_sec ?? null,
  };
}

async function campaignAndConnection(auth: Awaited<ReturnType<typeof requireAuth>>, campaignId: string) {
  const campaign = await getDb().campaign.findFirst({
    where: { id: campaignId, businessId: auth.businessId },
    include: {
      channels: true,
    },
  });
  if (!campaign) throw new Error('CAMPAIGN_NOT_FOUND');
  if (['PUBLISHING', 'PUBLISHED'].includes(campaign.status)) {
    throw new Error('TikTok settings cannot be changed after publishing starts.');
  }

  const connection = await getDb().socialConnection.findUnique({
    where: {
      businessId_channel: {
        businessId: auth.businessId,
        channel: 'TIKTOK',
      },
    },
  });
  if (!connection || connection.status !== 'READY') {
    throw new Error('TikTok must be connected before publishing settings can be configured.');
  }

  const channel = campaign.channels.find((item) => item.channel === 'TIKTOK');
  if (!channel) throw new Error('TikTok is not available on this campaign.');

  return { campaign, channel, connection };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    const { id } = await context.params;
    const { channel, connection } = await campaignAndConnection(auth, id);
    const accessToken = await validAccessToken(connection);
    const creator = await creatorInfo(accessToken);

    const metadata =
      channel.metadata && typeof channel.metadata === 'object' && !Array.isArray(channel.metadata)
        ? (channel.metadata as Record<string, unknown>)
        : {};

    return NextResponse.json({
      creator,
      saved: {
        privacyLevel:
          typeof metadata.privacyLevel === 'string' ? metadata.privacyLevel : null,
        allowComment: metadata.allowComment === true,
        allowDuet: metadata.allowDuet === true,
        allowStitch: metadata.allowStitch === true,
        consented: typeof metadata.consentAt === 'string',
        title: channel.variantCopy || '',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

const settingsSchema = z.object({
  privacyLevel: z.string().min(1).max(100),
  allowComment: z.boolean(),
  allowDuet: z.boolean(),
  allowStitch: z.boolean(),
  consent: z.literal(true),
  title: z.string().trim().min(1).max(2200),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    const { id } = await context.params;
    const input = settingsSchema.parse(await request.json());
    const { campaign, channel, connection } = await campaignAndConnection(auth, id);
    const accessToken = await validAccessToken(connection);
    const creator = await creatorInfo(accessToken);

    if (!creator.privacyLevelOptions.includes(input.privacyLevel)) {
      throw new Error('Choose one of the privacy options currently allowed by TikTok.');
    }
    if (creator.commentDisabled && input.allowComment) {
      throw new Error('Comments are disabled for this TikTok creator.');
    }
    if (creator.duetDisabled && input.allowDuet) {
      throw new Error('Duet is disabled for this TikTok creator.');
    }
    if (creator.stitchDisabled && input.allowStitch) {
      throw new Error('Stitch is disabled for this TikTok creator.');
    }

    await getDb().$transaction(async (tx) => {
      await tx.campaignChannel.update({
        where: { id: channel.id },
        data: {
          variantCopy: input.title,
          metadata: {
            privacyLevel: input.privacyLevel,
            allowComment: input.allowComment,
            allowDuet: input.allowDuet,
            allowStitch: input.allowStitch,
            consentAt: new Date().toISOString(),
            creatorNickname: creator.creatorNickname,
          },
        },
      });

      if (campaign.status === 'APPROVED' || campaign.status === 'SCHEDULED') {
        await tx.publishJob.updateMany({
          where: { campaignId: campaign.id, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
        await tx.campaign.update({
          where: { id: campaign.id },
          data: {
            status: 'READY',
            approvedAt: null,
            scheduledFor: null,
          },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
