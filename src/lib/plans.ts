export type PlanId = 'starter' | 'growth' | 'pro' | 'agency';

export interface PlanDefinition {
  id: PlanId;
  name: string;
  monthlyPriceEur: number;
  businesses: number;
  channels: number;
  monthlyPosts: number;
  monthlyCredits: number;
  stripePriceEnv: string;
  available: boolean;
}

export const plans: readonly PlanDefinition[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPriceEur: 19,
    businesses: 1,
    channels: 2,
    monthlyPosts: 15,
    monthlyCredits: 100,
    stripePriceEnv: 'STRIPE_PRICE_STARTER',
    available: true,
  },
  {
    id: 'growth',
    name: 'Growth',
    monthlyPriceEur: 49,
    businesses: 1,
    channels: 4,
    monthlyPosts: 60,
    monthlyCredits: 350,
    stripePriceEnv: 'STRIPE_PRICE_GROWTH',
    available: true,
  },
  {
    id: 'pro',
    name: 'Professional',
    monthlyPriceEur: 99,
    businesses: 3,
    channels: 12,
    monthlyPosts: 200,
    monthlyCredits: 900,
    stripePriceEnv: 'STRIPE_PRICE_PRO',
    available: false,
  },
  {
    id: 'agency',
    name: 'Agency',
    monthlyPriceEur: 249,
    businesses: 10,
    channels: 40,
    monthlyPosts: 600,
    monthlyCredits: 2500,
    stripePriceEnv: 'STRIPE_PRICE_AGENCY',
    available: false,
  },
] as const;

export function getPlan(id: string): PlanDefinition {
  return plans.find((plan) => plan.id === id) ?? plans[0];
}

export function configuredStripePrice(plan: PlanDefinition): string | null {
  return process.env[plan.stripePriceEnv] || null;
}
