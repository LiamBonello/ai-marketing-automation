import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

const globalForPrisma = globalThis as unknown as { marketPilotPrisma?: PrismaClient };

export function getDb(): PrismaClient {
  if (globalForPrisma.marketPilotPrisma) return globalForPrisma.marketPilotPrisma;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const adapter = new PrismaPg(
    {
      connectionString,
      max: 1,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    },
    { schema: process.env.DATABASE_SCHEMA || 'public' },
  );
  const client = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.marketPilotPrisma = client;
  }

  return client;
}
