import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/http';

const contactSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  firstName: z.string().trim().max(120).nullable().optional(),
  lastName: z.string().trim().max(120).nullable().optional(),
  consentSource: z.string().trim().min(2).max(300),
  consentAt: z.string().datetime().optional(),
});

const importSchema = z.object({
  contacts: z.array(contactSchema).min(1).max(1000),
});

export async function GET() {
  try {
    const auth = await requireAuth();
    const contacts = await getDb().contact.findMany({
      where: { businessId: auth.businessId },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    return NextResponse.json({ contacts });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const input = importSchema.parse(await request.json());

    for (const contact of input.contacts) {
      await getDb().contact.upsert({
        where: {
          businessId_email: {
            businessId: auth.businessId,
            email: contact.email,
          },
        },
        create: {
          businessId: auth.businessId,
          email: contact.email,
          firstName: contact.firstName,
          lastName: contact.lastName,
          consentSource: contact.consentSource,
          consentAt: contact.consentAt ? new Date(contact.consentAt) : new Date(),
          status: 'SUBSCRIBED',
        },
        update: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          consentSource: contact.consentSource,
          consentAt: contact.consentAt ? new Date(contact.consentAt) : new Date(),
        },
      });
    }

    return NextResponse.json({ imported: input.contacts.length }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
