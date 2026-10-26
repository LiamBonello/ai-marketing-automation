import { cookies } from 'next/headers';
import { hash, compare } from 'bcryptjs';
import { getDb } from '@/lib/db';
import { secureToken, sha256 } from '@/lib/crypto';

const SESSION_COOKIE = 'marketpilot_session';
const SESSION_DAYS = 30;

export interface AuthContext {
  userId: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  businessId: string;
  businessName: string;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}

export async function createSession(userId: string): Promise<void> {
  const token = secureToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await getDb().session.create({
    data: { userId, tokenHash: sha256(token), expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    path: '/',
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await getDb().session.deleteMany({ where: { tokenHash: sha256(token) } });
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await getDb().session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: {
        include: {
          memberships: {
            orderBy: { createdAt: 'asc' },
            include: {
              organization: {
                include: {
                  businesses: { orderBy: { createdAt: 'asc' }, take: 1 },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session) await getDb().session.delete({ where: { id: session.id } });
    return null;
  }

  const membership = session.user.memberships[0];
  const business = membership?.organization.businesses[0];
  if (!membership || !business) return null;

  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    organizationId: membership.organization.id,
    organizationName: membership.organization.name,
    role: membership.role,
    businessId: business.id,
    businessName: business.name,
  };
}

export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuthContext();
  if (!auth) throw new Error('UNAUTHORIZED');
  return auth;
}
