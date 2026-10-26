import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSession, verifyPassword } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/http';

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await getDb().user.findUnique({ where: { email: input.email } });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
