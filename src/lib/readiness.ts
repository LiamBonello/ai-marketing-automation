import type { AuthContext } from '@/lib/auth';
import { getDb } from '@/lib/db';

interface CampaignChannelReadiness {
  channel: 'INSTAGRAM' | 'TIKTOK' | 'X' | 'EMAIL';
  enabled: boolean;
  mediaUrl: string | null;
  metadata: unknown;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function assertPublishingReadiness(
  auth: AuthContext,
  channels: CampaignChannelReadiness[],
): Promise<void> {
  const enabled = channels.filter((channel) => channel.enabled);

  for (const channel of enabled) {
    if (channel.channel === 'EMAIL') {
      if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) {
        throw new Error('Email is enabled, but SMTP_HOST and SMTP_FROM are not configured.');
      }

      const subscribed = await getDb().contact.count({
        where: { businessId: auth.businessId, status: 'SUBSCRIBED' },
      });
      if (subscribed === 0) {
        throw new Error('Email is enabled, but there are no subscribed contacts.');
      }
      continue;
    }

    const connection = await getDb().socialConnection.findUnique({
      where: {
        businessId_channel: {
          businessId: auth.businessId,
          channel: channel.channel,
        },
      },
      select: { status: true },
    });

    if (!connection || connection.status !== 'READY') {
      const label = channel.channel === 'X' ? 'X' : channel.channel[0] + channel.channel.slice(1).toLowerCase();
      throw new Error(`${label} is enabled but is not connected and ready.`);
    }

    if ((channel.channel === 'INSTAGRAM' || channel.channel === 'TIKTOK') && !channel.mediaUrl) {
      throw new Error(`${channel.channel === 'INSTAGRAM' ? 'Instagram' : 'TikTok'} requires campaign media.`);
    }

    if (channel.channel === 'TIKTOK') {
      const settings = record(channel.metadata);
      if (
        typeof settings.privacyLevel !== 'string' ||
        typeof settings.consentAt !== 'string'
      ) {
        throw new Error('Review and confirm TikTok publishing settings before scheduling.');
      }
    }
  }
}
