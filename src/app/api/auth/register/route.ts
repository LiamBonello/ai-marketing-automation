import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSession, hashPassword } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/http';
import { slugify } from '@/lib/slug';
import { secureToken } from '@/lib/crypto';

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10).max(128),
  businessName: z.string().trim().min(2).max(160),
  acceptTerms: z.literal(true),
  acceptPrivacy: z.literal(true),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const db = getDb();
    const existing = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });

    const passwordHash = await hashPassword(input.password);
    const suffix = secureToken(4).toLowerCase();
    const slug = `${slugify(input.businessName)}-${suffix}`;

    const user = await db.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          termsAcceptedAt: new Date(),
          privacyAcceptedAt: new Date(),
        },
      });

      const organization = await tx.organization.create({
        data: {
          name: input.businessName,
          slug,
          creditBalance: 100,
          memberships: {
            create: { userId: createdUser.id, role: 'OWNER' },
          },
          businesses: {
            create: {
              name: input.businessName,
              primaryGoal: 'Grow the business',
              tone: 'Clear and professional',
            },
          },
          subscription: {
            create: {
              plan: 'starter',
              status: 'TRIALING',
              currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          },
        },
      });

      await tx.creditLedger.create({
        data: {
          organizationId: organization.id,
          type: 'PLAN_GRANT',
          amount: 100,
          balanceAfter: 100,
          externalRef: `signup:${organization.id}`,
          metadata: { source: 'signup' },
        },
      });

      return createdUser;
    });

    await createSession(user.id);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
