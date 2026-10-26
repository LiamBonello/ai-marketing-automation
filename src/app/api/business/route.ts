import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/http';

const updateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  website: z.string().trim().url().max(500).nullable().optional(),
  description: z.string().trim().max(3000).nullable().optional(),
  industry: z.string().trim().max(160).nullable().optional(),
  tone: z.string().trim().max(500).nullable().optional(),
  targetAudience: z.string().trim().max(1200).nullable().optional(),
  location: z.string().trim().max(300).nullable().optional(),
  primaryGoal: z.string().trim().max(500).nullable().optional(),
  brandGuidelines: z.string().trim().max(5000).nullable().optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
});

export async function GET() {
  try {
    const auth = await requireAuth();
    const business = await getDb().business.findFirst({
      where: { id: auth.businessId, organizationId: auth.organizationId },
      include: {
        socialConnections: {
          select: {
            channel: true,
            displayName: true,
            status: true,
            tokenExpiresAt: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!business) return NextResponse.json({ error: 'Business not found.' }, { status: 404 });

    const organization = await getDb().organization.findUnique({
      where: { id: auth.organizationId },
      select: {
        creditBalance: true,
        subscription: true,
      },
    });

    return NextResponse.json({ business, organization });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth();
    const input = updateSchema.parse(await request.json());

    const business = await getDb().business.update({
      where: { id: auth.businessId },
      data: input,
    });

    await audit({
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      action: 'business.updated',
      entityType: 'business',
      entityId: business.id,
      metadata: { fields: Object.keys(input) },
    });

    return NextResponse.json({ business });
  } catch (error) {
    return apiError(error);
  }
}
