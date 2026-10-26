import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { approveCampaign, getCampaign } from '@/lib/campaigns';
import { apiError } from '@/lib/http';
import { serializeCampaign } from '@/lib/serializers';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    const { id } = await context.params;
    await approveCampaign(auth, id);
    const campaign = await getCampaign(auth, id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
    return NextResponse.json({ campaign: serializeCampaign(campaign) });
  } catch (error) {
    return apiError(error);
  }
}
