import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { reviseCampaign } from '@/lib/campaigns';
import { apiError } from '@/lib/http';
import { serializeCampaign } from '@/lib/serializers';

const schema = z.object({
  instruction: z.string().trim().min(2).max(2000),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const campaign = await reviseCampaign(auth, id, input.instruction);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
    return NextResponse.json({ campaign: serializeCampaign(campaign) });
  } catch (error) {
    return apiError(error);
  }
}
