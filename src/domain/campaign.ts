export type MarketingChannel = 'instagram' | 'tiktok' | 'x' | 'email';

export type CampaignStatus =
  | 'draft'
  | 'ready'
  | 'approved'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled';

export interface CampaignChannel {
  id: MarketingChannel;
  label: string;
  enabled: boolean;
  copy?: string | null;
  subject?: string | null;
  mediaUrl?: string | null;
  externalPostId?: string | null;
}

export interface CampaignPreview {
  id: string;
  title: string;
  objective: string;
  caption: string;
  offer: string | null;
  callToAction: string;
  channels: CampaignChannel[];
  status: CampaignStatus;
  approvedAt?: string | null;
  scheduledFor?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
}

export interface CampaignSummary {
  id: string;
  title: string;
  status: CampaignStatus;
  channels: MarketingChannel[];
  scheduledFor?: string;
  performanceLabel?: string;
}
