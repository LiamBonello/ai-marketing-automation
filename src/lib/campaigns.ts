import { randomUUID } from 'node:crypto';
import type { AuthContext } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { debitCredits } from '@/lib/credits';
import { getDb } from '@/lib/db';
import { generateCampaignDraft } from '@/lib/ai';

export async function generateAndCreateCampaign(auth: AuthContext, request: string) {
  const cleanRequest = request.trim();
  if (cleanRequest.length < 3 || cleanRequest.length > 2000) {
    throw new Error('Campaign request must be between 3 and 2000 characters.');
  }

  const business = await getDb().business.findFirst({
    where: { id: auth.businessId, organizationId: auth.organizationId },
  });
  if (!business) throw new Error('BUSINESS_NOT_FOUND');

  const organization = await getDb().organization.findUniqueOrThrow({
    where: { id: auth.organizationId },
    select: { creditBalance: true },
  });
  if (organization.creditBalance < 1) throw new Error('INSUFFICIENT_CREDITS');

  const { draft, model } = await generateCampaignDraft({
    request: cleanRequest,
    business,
  });

  const campaign = await getDb().$transaction(async (tx) => {
    const created = await tx.campaign.create({
      data: {
        businessId: business.id,
        createdById: auth.userId,
        title: draft.title,
        objective: draft.objective,
        status: 'READY',
        versions: {
          create: {
            version: 1,
            createdById: auth.userId,
            caption: draft.caption,
            offer: draft.offer,
            callToAction: draft.callToAction,
            generationInput: cleanRequest,
            generatedBy: model,
            channelVariants: Object.fromEntries(
              draft.channels.map((channel) => [
                channel.channel,
                { copy: channel.copy, subject: channel.subject },
              ]),
            ),
          },
        },
        channels: {
          create: draft.channels.map((channel) => ({
            channel: channel.channel,
            enabled: channel.enabled,
            variantCopy: channel.copy,
            subject: channel.subject,
          })),
        },
      },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1 },
        channels: true,
      },
    });

    return created;
  });

  try {
    await debitCredits({
      organizationId: auth.organizationId,
      amount: 1,
      reason: 'campaign_text_generation',
      externalRef: `campaign-generation:${campaign.id}:v1`,
    });
  } catch (error) {
    await getDb().campaign.delete({ where: { id: campaign.id } });
    throw error;
  }

  await audit({
    organizationId: auth.organizationId,
    actorUserId: auth.userId,
    action: 'campaign.created',
    entityType: 'campaign',
    entityId: campaign.id,
    metadata: { model },
  });

  return campaign;
}

export async function listCampaigns(auth: AuthContext) {
  return getDb().campaign.findMany({
    where: { businessId: auth.businessId },
    orderBy: { createdAt: 'desc' },
    include: {
      versions: { orderBy: { version: 'desc' }, take: 1 },
      channels: true,
    },
  });
}

export async function getCampaign(auth: AuthContext, campaignId: string) {
  return getDb().campaign.findFirst({
    where: { id: campaignId, businessId: auth.businessId },
    include: {
      versions: { orderBy: { version: 'desc' }, take: 1 },
      channels: true,
      publishJobs: { orderBy: { createdAt: 'desc' } },
    },
  });
}

export async function setCampaignChannel(
  auth: AuthContext,
  campaignId: string,
  channel: 'INSTAGRAM' | 'TIKTOK' | 'X' | 'EMAIL',
  enabled: boolean,
) {
  const campaign = await getDb().campaign.findFirst({
    where: { id: campaignId, businessId: auth.businessId },
    select: { id: true, status: true },
  });
  if (!campaign) throw new Error('CAMPAIGN_NOT_FOUND');
  if (['PUBLISHING', 'PUBLISHED'].includes(campaign.status)) {
    throw new Error('Campaign channels cannot be changed after publishing starts.');
  }

  await getDb().campaignChannel.update({
    where: { campaignId_channel: { campaignId, channel } },
    data: { enabled },
  });

  if (campaign.status === 'APPROVED' || campaign.status === 'SCHEDULED') {
    await getDb().campaign.update({
      where: { id: campaignId },
      data: { status: 'READY', approvedAt: null, scheduledFor: null },
    });
    await getDb().publishJob.deleteMany({
      where: { campaignId, status: 'PENDING' },
    });
  }

  return getCampaign(auth, campaignId);
}

export async function approveCampaign(auth: AuthContext, campaignId: string) {
  const campaign = await getDb().campaign.findFirst({
    where: { id: campaignId, businessId: auth.businessId },
    include: { channels: true },
  });
  if (!campaign) throw new Error('CAMPAIGN_NOT_FOUND');
  if (!campaign.channels.some((channel) => channel.enabled)) {
    throw new Error('Enable at least one channel before approval.');
  }

  const approved = await getDb().$transaction(async (tx) => {
    const updated = await tx.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        scheduledFor: null,
        lastError: null,
      },
    });
    await tx.approvalEvent.create({
      data: {
        campaignId,
        userId: auth.userId,
        action: 'APPROVED',
      },
    });
    return updated;
  });

  await audit({
    organizationId: auth.organizationId,
    actorUserId: auth.userId,
    action: 'campaign.approved',
    entityType: 'campaign',
    entityId: campaignId,
  });

  return approved;
}

export async function scheduleCampaign(
  auth: AuthContext,
  campaignId: string,
  scheduledFor: Date,
) {
  if (!Number.isFinite(scheduledFor.getTime()) || scheduledFor <= new Date()) {
    throw new Error('Schedule time must be in the future.');
  }

  const campaign = await getDb().campaign.findFirst({
    where: { id: campaignId, businessId: auth.businessId },
    include: { channels: true },
  });
  if (!campaign) throw new Error('CAMPAIGN_NOT_FOUND');
  if (campaign.status !== 'APPROVED') {
    throw new Error('Campaign must be approved before it can be scheduled.');
  }

  const enabledChannels = campaign.channels.filter((channel) => channel.enabled);
  if (enabledChannels.length === 0) throw new Error('No channels are enabled.');

  await getDb().$transaction(async (tx) => {
    await tx.publishJob.deleteMany({
      where: { campaignId, status: 'PENDING' },
    });

    await tx.publishJob.createMany({
      data: enabledChannels.map((channel) => ({
        campaignId,
        channel: channel.channel,
        scheduledFor,
        idempotencyKey: `${campaignId}:${channel.channel}:${scheduledFor.toISOString()}:${randomUUID()}`,
      })),
    });

    await tx.campaign.update({
      where: { id: campaignId },
      data: { status: 'SCHEDULED', scheduledFor },
    });
  });

  await audit({
    organizationId: auth.organizationId,
    actorUserId: auth.userId,
    action: 'campaign.scheduled',
    entityType: 'campaign',
    entityId: campaignId,
    metadata: { scheduledFor: scheduledFor.toISOString() },
  });

  return getCampaign(auth, campaignId);
}

export async function cancelSchedule(auth: AuthContext, campaignId: string) {
  const campaign = await getDb().campaign.findFirst({
    where: { id: campaignId, businessId: auth.businessId },
  });
  if (!campaign) throw new Error('CAMPAIGN_NOT_FOUND');

  await getDb().$transaction([
    getDb().publishJob.updateMany({
      where: { campaignId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    }),
    getDb().campaign.update({
      where: { id: campaignId },
      data: {
        status: campaign.approvedAt ? 'APPROVED' : 'READY',
        scheduledFor: null,
      },
    }),
  ]);
}
