import type { CampaignPreview } from '@/domain/campaign';
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
