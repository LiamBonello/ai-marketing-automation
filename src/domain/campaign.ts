export type MarketingChannel = 'instagram' | 'tiktok' | 'x' | 'email';

export type CampaignStatus = 'draft' | 'ready' | 'scheduled' | 'published';

export interface CampaignChannel {
  id: MarketingChannel;
  label: string;
  enabled: boolean;
}

export interface CampaignPreview {
  id: string;
  title: string;
  objective: string;
  caption: string;
  offer: string;
  callToAction: string;
  channels: CampaignChannel[];
  status: CampaignStatus;
  scheduledFor?: string;
}

export interface CampaignSummary {
  id: string;
  title: string;
  status: CampaignStatus;
  channels: MarketingChannel[];
  scheduledFor?: string;
  performanceLabel?: string;
}
