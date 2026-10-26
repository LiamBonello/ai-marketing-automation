const channelName = {
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  X: 'X',
  EMAIL: 'Email',
} as const;

export function serializeCampaign(campaign: {
  id: string;
  title: string;
  objective: string;
  status: string;
  approvedAt?: Date | null;
  scheduledFor?: Date | null;
  publishedAt?: Date | null;
  createdAt?: Date;
  versions: Array<{
    version: number;
    caption: string;
    offer: string | null;
    callToAction: string | null;
  }>;
  channels: Array<{
    channel: keyof typeof channelName;
    enabled: boolean;
    variantCopy: string | null;
    subject: string | null;
    mediaUrl: string | null;
    externalPostId?: string | null;
  }>;
}) {
  const version = campaign.versions[0];
  return {
    id: campaign.id,
    title: campaign.title,
    objective: campaign.objective,
    caption: version?.caption ?? '',
    offer: version?.offer ?? null,
    callToAction: version?.callToAction ?? '',
    status: campaign.status.toLowerCase(),
    approvedAt: campaign.approvedAt?.toISOString() ?? null,
    scheduledFor: campaign.scheduledFor?.toISOString() ?? null,
    publishedAt: campaign.publishedAt?.toISOString() ?? null,
    createdAt: campaign.createdAt?.toISOString() ?? null,
    channels: campaign.channels.map((channel) => ({
      id: channel.channel.toLowerCase(),
      label: channelName[channel.channel],
      enabled: channel.enabled,
      copy: channel.variantCopy,
      subject: channel.subject,
      mediaUrl: channel.mediaUrl,
      externalPostId: channel.externalPostId ?? null,
    })),
  };
}
