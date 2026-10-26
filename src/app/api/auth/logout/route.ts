import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';
import { apiError } from '@/lib/http';

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
