import { NextResponse } from 'next/server';
import { z } from 'zod';
import { audit } from '@/lib/audit';
import { requireEnv } from '@/lib/app-config';
import { safeEqual } from '@/lib/crypto';
import { getDb } from '@/lib/db';

const webhookSchema = z.object({
  event: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
}).passthrough();

function contactIdFromPayload(payload: Record<string, unknown>): string | null {
  const custom = payload['X-Mailin-custom'];
  if (typeof custom !== 'string') return null;

  const match = custom.match(/(?:^|\s)marketpilot-contact:([A-Za-z0-9_-]+)(?:\s|$)/);
  return match?.[1] ?? null;
}

function suppressionForEvent(event: string):
  | { status: 'BOUNCED' | 'COMPLAINED' | 'UNSUBSCRIBED'; action: string }
  | null {
  switch (event) {
    case 'hard_bounce':
    case 'invalid_email':
    case 'blocked':
      return { status: 'BOUNCED', action: 'contact.bounced' };
    case 'spam':
      return { status: 'COMPLAINED', action: 'contact.complained' };
    case 'unsubscribed':
      return { status: 'UNSUBSCRIBED', action: 'contact.unsubscribed' };
    default:
      return null;
  }
}

export async function POST(request: Request) {
  const configured = process.env.BREVO_WEBHOOK_SECRET?.trim();
  if (!configured || configured.startsWith('REPLACE_ME_')) {
    return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 503 });
  }

  const authorization = request.headers.get('authorization') || '';
  const provided = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!provided || !safeEqual(provided, configured)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const input = webhookSchema.safeParse(await request.json());
  if (!input.success) {
    return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 });
  }

  const suppression = suppressionForEvent(input.data.event);
  if (!suppression) return NextResponse.json({ ok: true });

  const contactId = contactIdFromPayload(input.data);
  if (!contactId) return NextResponse.json({ ok: true });

  const contact = await getDb().contact.findFirst({
    where: { id: contactId, email: input.data.email },
    include: {
      business: {
        select: { organizationId: true },
      },
    },
  });
  if (!contact) return NextResponse.json({ ok: true });

  const where =
    suppression.status === 'COMPLAINED'
      ? { id: contact.id, status: { not: 'COMPLAINED' as const } }
      : { id: contact.id, status: 'SUBSCRIBED' as const };

  const updated = await getDb().contact.updateMany({
    where,
    data: {
      status: suppression.status,
      ...(suppression.status === 'UNSUBSCRIBED'
        ? { unsubscribedAt: new Date() }
        : {}),
    },
  });

  if (updated.count === 1) {
    await audit({
      organizationId: contact.business.organizationId,
      actorUserId: null,
      action: suppression.action,
      entityType: 'contact',
      entityId: contact.id,
      metadata: {
        provider: 'brevo',
        event: input.data.event,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
