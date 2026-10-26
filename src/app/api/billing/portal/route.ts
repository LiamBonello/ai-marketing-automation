import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createBillingPortal } from '@/lib/billing';
import { apiError } from '@/lib/http';

export async function POST() {
  try {
    const auth = await requireAuth();
    return NextResponse.json({ url: await createBillingPortal(auth) });
  } catch (error) {
    return apiError(error);
  }
}
