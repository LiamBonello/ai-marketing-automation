import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { apiError } from '@/lib/http';
import { setCampaignMedia } from '@/lib/media';

const setSchema = z.object({
  mediaUrl: z.string().url(),
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
