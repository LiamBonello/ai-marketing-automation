import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { getCampaign, setCampaignChannel } from '@/lib/campaigns';
import { apiError } from '@/lib/http';
import { serializeCampaign } from '@/lib/serializers';

const channelSchema = z.object({
  channel: z.enum(['INSTAGRAM', 'TIKTOK', 'X', 'EMAIL']),
  enabled: z.boolean(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    const { id } = await context.params;
    const campaign = await getCampaign(auth, id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
    return NextResponse.json({ campaign: serializeCampaign(campaign) });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    const { id } = await context.params;
    const input = channelSchema.parse(await request.json());
    const campaign = await setCampaignChannel(auth, id, input.channel, input.enabled);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
    return NextResponse.json({ campaign: serializeCampaign(campaign) });
  } catch (error) {
    return apiError(error);
  }
}
