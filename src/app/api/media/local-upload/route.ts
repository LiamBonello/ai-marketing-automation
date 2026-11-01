import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiError } from '@/lib/http';
import { saveLocalUpload } from '@/lib/media';

export async function PUT(request: Request) {
  try {
    const auth = await requireAuth();
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    const contentType = request.headers.get('content-type') || '';

    if (!key) {
      return NextResponse.json({ error: 'Missing upload key.' }, { status: 400 });
    }

    const bytes = Buffer.from(await request.arrayBuffer());
    const publicUrl = await saveLocalUpload({
      auth,
      key,
      bytes,
      contentType,
    });

    return NextResponse.json({ publicUrl });
  } catch (error) {
    return apiError(error);
  }
}
