import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { apiError } from '@/lib/http';
import { createUploadUrl } from '@/lib/media';

const schema = z.object({
  contentType: z.string().min(1).max(100),
  fileSize: z.number().int().positive(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const input = schema.parse(await request.json());
    return NextResponse.json(await createUploadUrl({ auth, ...input }));
  } catch (error) {
    return apiError(error);
  }
}
