import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

const globalForPrisma = globalThis as unknown as { marketPilotPrisma?: PrismaClient };

function runtimeConnectionString(value: string): string {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  const isSupabasePooler = hostname.endsWith('.pooler.supabase.com');

  if (
    isSupabasePooler &&
    url.searchParams.get('sslmode') === 'require' &&
    !url.searchParams.has('uselibpqcompat')
  ) {
    url.searchParams.set('uselibpqcompat', 'true');
  }

  return url.toString();
}

export function getDb(): PrismaClient {
  if (globalForPrisma.marketPilotPrisma) return globalForPrisma.marketPilotPrisma;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const adapter = new PrismaPg(
    {
      connectionString: runtimeConnectionString(connectionString),
      max: Number(process.env.DATABASE_POOL_MAX || (process.env.NODE_ENV === 'production' ? 1 : 10)),
    },
    { schema: process.env.DATABASE_SCHEMA || 'public' },
  );
  const client = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.marketPilotPrisma = client;
  }

  return client;
}
