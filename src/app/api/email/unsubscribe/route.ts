import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyUnsubscribeToken } from '@/lib/publisher';

function response(message: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>MarketPilot</title></head><body style="font-family:system-ui;padding:48px;max-width:640px;margin:auto"><h1>Email preferences</h1><p>${message}</p></body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const contactId = url.searchParams.get('contact');
  const token = url.searchParams.get('token');
  if (!contactId || !token || !verifyUnsubscribeToken(contactId, token)) {
    return response('This unsubscribe link is invalid.', 400);
  }

  await getDb().contact.updateMany({
    where: { id: contactId },
    data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() },
  });
  return response('You have been unsubscribed and will not receive further marketing emails from this business.');
}
