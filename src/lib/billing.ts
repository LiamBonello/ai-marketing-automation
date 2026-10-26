import Stripe from 'stripe';
import type { AuthContext } from '@/lib/auth';
import { appUrl, requireEnv } from '@/lib/app-config';
import { getDb } from '@/lib/db';
import { configuredStripePrice, getPlan, plans } from '@/lib/plans';
import { grantCredits } from '@/lib/credits';

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) stripeInstance = new Stripe(requireEnv('STRIPE_SECRET_KEY'));
  return stripeInstance;
}

async function ensureCustomer(auth: AuthContext): Promise<string> {
  const organization = await getDb().organization.findUniqueOrThrow({
    where: { id: auth.organizationId },
    select: { stripeCustomerId: true },
  });

  if (organization.stripeCustomerId) return organization.stripeCustomerId;

  const customer = await getStripe().customers.create({
    email: auth.email,
    name: auth.organizationName,
    metadata: { organizationId: auth.organizationId },
  });

  await getDb().organization.update({
    where: { id: auth.organizationId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function createPlanCheckout(auth: AuthContext, planId: string): Promise<string> {
  const plan = getPlan(planId);
  const price = configuredStripePrice(plan);
  if (!price) throw new Error(`${plan.stripePriceEnv} is not configured.`);

  const current = await getDb().subscription.findUnique({
    where: { organizationId: auth.organizationId },
  });

  if (
    current?.stripeSubscriptionId &&
    (current.status === 'ACTIVE' || current.status === 'TRIALING')
  ) {
    const stripeSubscription = await getStripe().subscriptions.retrieve(
      current.stripeSubscriptionId,
    );
    const item = stripeSubscription.items.data[0];
    if (!item) throw new Error('The current Stripe subscription has no subscription item.');

    await getStripe().subscriptions.update(current.stripeSubscriptionId, {
      items: [{ id: item.id, price }],
      proration_behavior: 'create_prorations',
      metadata: {
        ...stripeSubscription.metadata,
        organizationId: auth.organizationId,
        plan: plan.id,
      },
    });

    return `${appUrl()}/business?billing=updated`;
  }

  if (current?.stripeSubscriptionId && current.status === 'PAST_DUE') {
    throw new Error('Resolve the outstanding subscription balance in the billing portal before changing plans.');
  }

  const customer = await ensureCustomer(auth);
  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [{ price, quantity: 1 }],
    success_url: `${appUrl()}/business?billing=success`,
    cancel_url: `${appUrl()}/business?billing=cancelled`,
    client_reference_id: auth.organizationId,
    metadata: {
      organizationId: auth.organizationId,
      plan: plan.id,
      purchaseType: 'subscription',
    },
    subscription_data: {
      metadata: {
        organizationId: auth.organizationId,
        plan: plan.id,
      },
    },
    allow_promotion_codes: true,
  });

  if (!session.url) throw new Error('Stripe did not return a Checkout URL.');
  return session.url;
}

const creditPacks = {
  '100': { amount: 100, env: 'STRIPE_PRICE_CREDITS_100' },
  '300': { amount: 300, env: 'STRIPE_PRICE_CREDITS_300' },
  '1000': { amount: 1000, env: 'STRIPE_PRICE_CREDITS_1000' },
} as const;

export async function createCreditCheckout(auth: AuthContext, pack: keyof typeof creditPacks): Promise<string> {
  const definition = creditPacks[pack];
  const price = process.env[definition.env];
  if (!price) throw new Error(`${definition.env} is not configured.`);

  const customer = await ensureCustomer(auth);
  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    customer,
    line_items: [{ price, quantity: 1 }],
    success_url: `${appUrl()}/business?credits=success`,
    cancel_url: `${appUrl()}/business?credits=cancelled`,
    client_reference_id: auth.organizationId,
    metadata: {
      organizationId: auth.organizationId,
      purchaseType: 'credits',
      creditAmount: String(definition.amount),
    },
  });

  if (!session.url) throw new Error('Stripe did not return a Checkout URL.');
  return session.url;
}

export async function createBillingPortal(auth: AuthContext): Promise<string> {
  const customer = await ensureCustomer(auth);
  const session = await getStripe().billingPortal.sessions.create({
    customer,
    return_url: `${appUrl()}/business`,
  });
  return session.url;
}

function subscriptionStatus(status: Stripe.Subscription.Status) {
  switch (status) {
    case 'trialing': return 'TRIALING' as const;
    case 'active': return 'ACTIVE' as const;
    case 'past_due': return 'PAST_DUE' as const;
    case 'canceled': return 'CANCELED' as const;
    case 'unpaid': return 'UNPAID' as const;
    case 'incomplete': return 'INCOMPLETE' as const;
    case 'incomplete_expired': return 'INCOMPLETE_EXPIRED' as const;
    case 'paused': return 'PAUSED' as const;
    default: return 'INCOMPLETE' as const;
  }
}

function planFromPrice(priceId: string | undefined): string {
  if (!priceId) return 'starter';
  for (const plan of plans) {
    if (configuredStripePrice(plan) === priceId) return plan.id;
  }
  return 'starter';
}

export async function syncSubscription(subscription: Stripe.Subscription): Promise<void> {
  const organizationId = subscription.metadata.organizationId;
  if (!organizationId) return;

  const item = subscription.items.data[0];
  const plan = subscription.metadata.plan || planFromPrice(item?.price.id);
  const currentPeriodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000)
    : null;

  await getDb().subscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      plan,
      status: subscriptionStatus(subscription.status),
      stripeSubscriptionId: subscription.id,
      stripePriceId: item?.price.id,
      currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    update: {
      plan,
      status: subscriptionStatus(subscription.status),
      stripeSubscriptionId: subscription.id,
      stripePriceId: item?.price.id,
      currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const value = invoice as unknown as {
    subscription?: string | { id?: string } | null;
    parent?: {
      subscription_details?: {
        subscription?: string | { id?: string } | null;
      } | null;
    } | null;
  };

  const candidate = value.parent?.subscription_details?.subscription ?? value.subscription;
  if (typeof candidate === 'string') return candidate;
  return candidate?.id ?? null;
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    await syncSubscription(event.data.object as Stripe.Subscription);
    return;
  }

  if (event.type === 'customer.subscription.deleted') {
    await syncSubscription(event.data.object as Stripe.Subscription);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const organizationId = session.metadata?.organizationId;
    if (!organizationId) return;

    if (session.metadata?.purchaseType === 'credits' && session.payment_status === 'paid') {
      const amount = Number(session.metadata.creditAmount);
      if (Number.isInteger(amount) && amount > 0) {
        await grantCredits({
          organizationId,
          amount,
          type: 'CREDIT_PACK',
          externalRef: `stripe-checkout:${session.id}`,
          metadata: { checkoutSessionId: session.id },
        });
      }
    }
    return;
  }

  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = invoiceSubscriptionId(invoice);
    if (!subscriptionId) return;

    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
    await syncSubscription(subscription);

    const organizationId = subscription.metadata.organizationId;
    if (!organizationId) return;

    const planId = subscription.metadata.plan || planFromPrice(subscription.items.data[0]?.price.id);
    const plan = getPlan(planId);

    await grantCredits({
      organizationId,
      amount: plan.monthlyCredits,
      type: 'PLAN_GRANT',
      externalRef: `stripe-invoice:${invoice.id}`,
      metadata: { invoiceId: invoice.id, plan: plan.id },
    });
  }
}
