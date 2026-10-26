import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { createCreditCheckout, createPlanCheckout } from '@/lib/billing';
import { apiError } from '@/lib/http';

const schema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('plan'), plan: z.enum(['starter', 'growth', 'pro', 'agency']) }),
  z.object({ type: z.literal('credits'), pack: z.enum(['100', '300', '1000']) }),
]);

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const input = schema.parse(await request.json());
    const url =
      input.type === 'plan'
        ? await createPlanCheckout(auth, input.plan)
        : await createCreditCheckout(auth, input.pack);

    return NextResponse.json({ url });
  } catch (error) {
    return apiError(error);
  }
}
