import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyUnsubscribeToken } from '@/lib/publisher';

function response(message: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>MarketPilot</title></head><body style="font-family:system-ui;padding:48px;max-width:640px;margin:auto"><h1>Email preferences</h1><p>${message}</p></body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

function requestCredentials(request: Request): { contactId: string | null; token: string | null } {
  const url = new URL(request.url);
  return {
    contactId: url.searchParams.get('contact'),
    token: url.searchParams.get('token'),
  };
}

async function unsubscribe(contactId: string, token: string): Promise<boolean> {
  if (!verifyUnsubscribeToken(contactId, token)) return false;

  const result = await getDb().contact.updateMany({
    where: { id: contactId },
    data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() },
  });

  return result.count === 1;
}

export async function GET(request: Request) {
  const { contactId, token } = requestCredentials(request);
  if (!contactId || !token || !(await unsubscribe(contactId, token))) {
    return response('This unsubscribe link is invalid.', 400);
  }

  return response(
    'You have been unsubscribed and will not receive further marketing emails from this business.',
  );
}

export async function POST(request: Request) {
  const { contactId, token } = requestCredentials(request);
  if (!contactId || !token || !(await unsubscribe(contactId, token))) {
    return NextResponse.json({ error: 'Invalid unsubscribe request.' }, { status: 400 });
  }

  return new NextResponse(null, { status: 200 });
}
