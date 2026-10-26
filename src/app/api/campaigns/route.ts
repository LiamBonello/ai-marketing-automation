import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { generateAndCreateCampaign, listCampaigns } from '@/lib/campaigns';
import { apiError } from '@/lib/http';
import { serializeCampaign } from '@/lib/serializers';

const createSchema = z.object({
  request: z.string().trim().min(3).max(2000),
});

export async function GET() {
  try {
    const auth = await requireAuth();
    const campaigns = await listCampaigns(auth);
    return NextResponse.json({ campaigns: campaigns.map(serializeCampaign) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const input = createSchema.parse(await request.json());
    const campaign = await generateAndCreateCampaign(auth, input.request);
    return NextResponse.json({ campaign: serializeCampaign(campaign) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
