export interface DemoCampaignApiResponse {
  campaign_id: string;
  campaign_title: string;
  goal: string;
  body_copy: string;
  offer_text: string;
  cta_text: string;
  campaign_status: 'draft' | 'ready' | 'scheduled' | 'published';
  selected_channels: Array<{
    channel: 'instagram' | 'tiktok' | 'x' | 'email';
    display_name: string;
    is_enabled: boolean;
  }>;
  scheduled_for?: string | null;
}

export const demoCampaignResponse: DemoCampaignApiResponse = {
  campaign_id: 'cmp_demo_sunday_brunch',
  campaign_title: 'Sunday Brunch Promotion',
  goal: 'Increase weekend reservations',
  body_copy:
    'Make Sunday the easiest decision of the week. Join us for a relaxed brunch, great food, and time well spent with the people you like most.',
  offer_text: 'Sunday brunch from EUR25 per person',
  cta_text: 'Reserve your table',
  campaign_status: 'ready',
  selected_channels: [
    { channel: 'instagram', display_name: 'Instagram', is_enabled: true },
    { channel: 'tiktok', display_name: 'TikTok', is_enabled: true },
    { channel: 'x', display_name: 'X', is_enabled: false },
    { channel: 'email', display_name: 'Email', is_enabled: false },
  ],
  scheduled_for: null,
};
