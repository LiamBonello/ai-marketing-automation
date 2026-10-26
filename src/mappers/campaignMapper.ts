import type { CampaignPreview, MarketingChannel } from '@/domain/campaign';
import type { DemoCampaignApiResponse } from '@/data/demoCampaign';

export function mapCampaignResponse(response: DemoCampaignApiResponse): CampaignPreview {
  return {
    id: response.campaign_id,
    title: response.campaign_title,
    objective: response.goal,
    caption: response.body_copy,
    offer: response.offer_text,
    callToAction: response.cta_text,
    status: response.campaign_status,
    scheduledFor: response.scheduled_for ?? undefined,
    channels: response.selected_channels.map((channel) => ({
      id: channel.channel,
      label: channel.display_name,
      enabled: channel.is_enabled,
    })),
  };
}

export interface LiveCampaignApiResponse {
  id: string;
  title: string;
  objective: string;
  caption: string;
  offer: string | null;
  callToAction: string;
  status: CampaignPreview['status'];
  approvedAt?: string | null;
  scheduledFor?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  channels: Array<{
    id: string;
    label: string;
    enabled: boolean;
    copy?: string | null;
    subject?: string | null;
    mediaUrl?: string | null;
    externalPostId?: string | null;
  }>;
}

export function mapLiveCampaign(response: LiveCampaignApiResponse): CampaignPreview {
  const allowed = new Set<MarketingChannel>(['instagram', 'tiktok', 'x', 'email']);
  return {
    ...response,
    channels: response.channels
      .filter((channel): channel is typeof channel & { id: MarketingChannel } =>
        allowed.has(channel.id as MarketingChannel),
      )
      .map((channel) => ({
        id: channel.id,
        label: channel.label,
        enabled: channel.enabled,
        copy: channel.copy,
        subject: channel.subject,
        mediaUrl: channel.mediaUrl,
        externalPostId: channel.externalPostId,
      })),
  };
}
