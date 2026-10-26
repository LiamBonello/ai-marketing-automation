import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/http';

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ authenticated: false }, { status: 401 });

    const organization = await getDb().organization.findUnique({
      where: { id: auth.organizationId },
      select: {
        creditBalance: true,
        subscription: {
          select: { plan: true, status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
        },
      },
    });

    return NextResponse.json({
      authenticated: true,
      ...auth,
      creditBalance: organization?.creditBalance ?? 0,
      subscription: organization?.subscription ?? null,
    });
  } catch (error) {
    return apiError(error);
  }
}
