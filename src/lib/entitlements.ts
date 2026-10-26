import type { AuthContext } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getPlan } from '@/lib/plans';

export async function assertSchedulingEntitlement(
  auth: AuthContext,
  enabledChannelCount: number,
  scheduledFor: Date,
  excludeCampaignId?: string,
): Promise<void> {
  const organization = await getDb().organization.findUniqueOrThrow({
    where: { id: auth.organizationId },
    select: { subscription: true },
  });

  const subscription = organization.subscription;
  const plan = getPlan(subscription?.plan ?? 'starter');
  const status = subscription?.status ?? 'INCOMPLETE';

  if (!['ACTIVE', 'TRIALING'].includes(status)) {
    throw new Error('An active subscription or trial is required to schedule publishing.');
  }

  if (
    status === 'TRIALING' &&
    (!subscription?.currentPeriodEnd || subscription.currentPeriodEnd <= new Date())
  ) {
    throw new Error('Your publishing trial has expired. Choose a subscription before scheduling.');
  }

  if (enabledChannelCount > plan.channels) {
    throw new Error(
      `Your ${plan.name} plan supports up to ${plan.channels} channels per campaign.`,
    );
  }

  const monthStart = new Date(
    Date.UTC(scheduledFor.getUTCFullYear(), scheduledFor.getUTCMonth(), 1),
  );
  const nextMonth = new Date(
    Date.UTC(scheduledFor.getUTCFullYear(), scheduledFor.getUTCMonth() + 1, 1),
  );

  const existingPosts = await getDb().publishJob.count({
    where: {
      campaign: {
        business: { organizationId: auth.organizationId },
      },
      status: { not: 'CANCELLED' },
      campaignId: excludeCampaignId ? { not: excludeCampaignId } : undefined,
      scheduledFor: { gte: monthStart, lt: nextMonth },
    },
  });

  if (existingPosts + enabledChannelCount > plan.monthlyPosts) {
    throw new Error(
      `Scheduling this campaign would exceed your ${plan.name} plan limit of ${plan.monthlyPosts} posts for that month.`,
    );
  }
}
