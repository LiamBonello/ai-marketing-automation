import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { cancelSchedule, scheduleCampaign } from '@/lib/campaigns';
import { apiError } from '@/lib/http';
import { serializeCampaign } from '@/lib/serializers';

const scheduleSchema = z.object({
  scheduledFor: z.string().datetime(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    const { id } = await context.params;
    const input = scheduleSchema.parse(await request.json());
    const campaign = await scheduleCampaign(auth, id, new Date(input.scheduledFor));
    if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
    return NextResponse.json({ campaign: serializeCampaign(campaign) });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    const { id } = await context.params;
    await cancelSchedule(auth, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
