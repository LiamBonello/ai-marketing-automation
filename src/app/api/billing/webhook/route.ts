import { NextResponse } from 'next/server';
import { getStripe, handleStripeEvent } from '@/lib/billing';
import { requireEnv } from '@/lib/app-config';

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });

  try {
    const body = await request.text();
    const event = getStripe().webhooks.constructEvent(
      body,
      signature,
      requireEnv('STRIPE_WEBHOOK_SECRET'),
    );
    await handleStripeEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
