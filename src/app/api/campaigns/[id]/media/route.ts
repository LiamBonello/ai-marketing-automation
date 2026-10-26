import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { apiError } from '@/lib/http';
import { generateCampaignImage, setCampaignMedia } from '@/lib/media';

const setSchema = z.object({
  mediaUrl: z.string().url(),
});

const generateSchema = z.object({
  prompt: z.string().trim().max(2000).optional(),
});


export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    const { id } = await context.params;
    const input = setSchema.parse(await request.json());
    await setCampaignMedia(auth, id, input.mediaUrl);
    return NextResponse.json({ mediaUrl: input.mediaUrl });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const input = generateSchema.parse(body);
    const mediaUrl = await generateCampaignImage(auth, id, input.prompt);
    return NextResponse.json({ mediaUrl });
  } catch (error) {
    return apiError(error);
  }
}
