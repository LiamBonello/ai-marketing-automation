import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyUnsubscribeToken } from '@/lib/publisher';

function htmlResponse(body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>MarketPilot</title></head><body style="font-family:system-ui;padding:48px;max-width:640px;margin:auto">${body}</body></html>`,
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
  if (!contactId || !token || !verifyUnsubscribeToken(contactId, token)) {
    return htmlResponse('<h1>Email preferences</h1><p>This unsubscribe link is invalid.</p>', 400);
  }

  const action = new URL('/api/email/unsubscribe', request.url);
  action.searchParams.set('contact', contactId);
  action.searchParams.set('token', token);

  return htmlResponse(
    `<h1>Email preferences</h1><p>Confirm that you want to stop receiving marketing emails from this business.</p><form method="post" action="${action.toString()}"><button type="submit" style="font:inherit;padding:10px 16px;cursor:pointer">Unsubscribe</button></form>`,
  );
}

export async function POST(request: Request) {
  const { contactId, token } = requestCredentials(request);
  if (!contactId || !token || !(await unsubscribe(contactId, token))) {
    const acceptsHtml = request.headers.get('accept')?.includes('text/html');
    return acceptsHtml
      ? htmlResponse('<h1>Email preferences</h1><p>This unsubscribe link is invalid.</p>', 400)
      : NextResponse.json({ error: 'Invalid unsubscribe request.' }, { status: 400 });
  }

  const acceptsHtml = request.headers.get('accept')?.includes('text/html');
  return acceptsHtml
    ? htmlResponse(
        '<h1>Email preferences</h1><p>You have been unsubscribed and will not receive further marketing emails from this business.</p>',
      )
    : new NextResponse(null, { status: 200 });
}
