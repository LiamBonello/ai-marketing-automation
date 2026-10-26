import type { AuthContext } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { debitCredits } from '@/lib/credits';
import { getDb } from '@/lib/db';
import { generateCampaignDraft } from '@/lib/ai';
import { assertSchedulingEntitlement } from '@/lib/entitlements';

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

export async function reviseCampaign(
  auth: AuthContext,
  campaignId: string,
  instruction: string,
) {
  const cleanInstruction = instruction.trim();
  if (cleanInstruction.length < 2 || cleanInstruction.length > 2000) {
    throw new Error('Revision instruction must be between 2 and 2000 characters.');
  }

  const campaign = await getDb().campaign.findFirst({
    where: { id: campaignId, businessId: auth.businessId },
    include: {
      business: true,
      versions: { orderBy: { version: 'desc' }, take: 1 },
      channels: true,
    },
  });
  if (!campaign) throw new Error('CAMPAIGN_NOT_FOUND');
  if (['PUBLISHING', 'PUBLISHED'].includes(campaign.status)) {
    throw new Error('Published campaigns cannot be revised.');
  }

  const organization = await getDb().organization.findUniqueOrThrow({
    where: { id: auth.organizationId },
    select: { creditBalance: true },
  });
  if (organization.creditBalance < 1) throw new Error('INSUFFICIENT_CREDITS');

  const current = campaign.versions[0];
  if (!current) throw new Error('Campaign has no current version.');

  const { draft, model } = await generateCampaignDraft({
    request: [
      'Revise the existing campaign according to the user instruction.',
      `User instruction: ${cleanInstruction}`,
      `Existing title: ${campaign.title}`,
      `Existing objective: ${campaign.objective}`,
      `Existing caption: ${current.caption}`,
      current.offer ? `Existing offer: ${current.offer}` : 'Existing offer: none',
      current.callToAction ? `Existing call to action: ${current.callToAction}` : '',
      'Preserve confirmed business facts and do not invent new commercial claims.',
    ].filter(Boolean).join('\n'),
    business: campaign.business,
  });

  const nextVersion = campaign.version + 1;

  await getDb().$transaction(async (tx) => {
    const debited = await tx.organization.updateMany({
      where: {
        id: auth.organizationId,
        creditBalance: { gte: 1 },
      },
      data: { creditBalance: { decrement: 1 } },
    });
    if (debited.count !== 1) throw new Error('INSUFFICIENT_CREDITS');

    const balance = await tx.organization.findUniqueOrThrow({
      where: { id: auth.organizationId },
      select: { creditBalance: true },
    });

    await tx.creditLedger.create({
      data: {
        organizationId: auth.organizationId,
        type: 'AI_GENERATION',
        amount: -1,
        balanceAfter: balance.creditBalance,
        externalRef: `campaign-revision:${campaignId}:v${nextVersion}`,
        metadata: { reason: 'campaign_text_revision' },
      },
    });

    await tx.campaignVersion.create({
      data: {
        campaignId,
        createdById: auth.userId,
        version: nextVersion,
        caption: draft.caption,
        offer: draft.offer,
        callToAction: draft.callToAction,
        generationInput: cleanInstruction,
        generatedBy: model,
        channelVariants: Object.fromEntries(
          draft.channels.map((channel) => [
            channel.channel,
            { copy: channel.copy, subject: channel.subject },
          ]),
        ),
      },
    });

    await tx.campaign.update({
      where: { id: campaignId },
      data: {
        title: draft.title,
        objective: draft.objective,
        version: nextVersion,
        status: 'READY',
        approvedAt: null,
        scheduledFor: null,
        lastError: null,
      },
    });

    for (const channel of draft.channels) {
      await tx.campaignChannel.upsert({
        where: { campaignId_channel: { campaignId, channel: channel.channel } },
        create: {
          campaignId,
          channel: channel.channel,
          enabled: channel.enabled,
          variantCopy: channel.copy,
          subject: channel.subject,
        },
        update: {
          enabled: channel.enabled,
          variantCopy: channel.copy,
          subject: channel.subject,
        },
      });
    }

    await tx.publishJob.updateMany({
      where: { campaignId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
  });

  await audit({
    organizationId: auth.organizationId,
    actorUserId: auth.userId,
    action: 'campaign.revised',
    entityType: 'campaign',
    entityId: campaignId,
    metadata: { version: nextVersion, model },
  });

  return getCampaign(auth, campaignId);
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
    await getDb().publishJob.updateMany({
      where: { campaignId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
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

  await assertSchedulingEntitlement(auth, enabledChannels.length, scheduledFor);

  await getDb().$transaction(async (tx) => {
    await tx.publishJob.updateMany({
      where: { campaignId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });

    await tx.publishJob.createMany({
      data: enabledChannels.map((channel) => ({
        campaignId,
        channel: channel.channel,
        scheduledFor,
        idempotencyKey: `${campaignId}:${channel.channel}:${scheduledFor.toISOString()}:v${campaign.version}`,
      })),
      skipDuplicates: true,
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
