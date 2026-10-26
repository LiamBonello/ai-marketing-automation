import { Prisma } from '@/generated/prisma/client';
import { getDb } from '@/lib/db';

export async function debitCredits(input: {
  organizationId: string;
  amount: number;
  reason: string;
  externalRef?: string;
}): Promise<number> {
  if (input.amount <= 0) throw new Error('Credit debit must be positive.');

  return getDb().$transaction(async (tx) => {
    const updated = await tx.organization.updateMany({
      where: {
        id: input.organizationId,
        creditBalance: { gte: input.amount },
      },
      data: { creditBalance: { decrement: input.amount } },
    });

    if (updated.count !== 1) throw new Error('INSUFFICIENT_CREDITS');

    const organization = await tx.organization.findUniqueOrThrow({
      where: { id: input.organizationId },
      select: { creditBalance: true },
    });

    await tx.creditLedger.create({
      data: {
        organizationId: input.organizationId,
        type: 'AI_GENERATION',
        amount: -input.amount,
        balanceAfter: organization.creditBalance,
        externalRef: input.externalRef,
        metadata: { reason: input.reason },
      },
    });

    return organization.creditBalance;
  });
}

export async function grantCredits(input: {
  organizationId: string;
  amount: number;
  externalRef: string;
  type?: 'PLAN_GRANT' | 'CREDIT_PACK' | 'REFUND' | 'ADMIN_ADJUSTMENT';
  metadata?: Prisma.InputJsonValue;
}): Promise<number> {
  if (input.amount <= 0) throw new Error('Credit grant must be positive.');

  return getDb().$transaction(async (tx) => {
    const existing = await tx.creditLedger.findUnique({
      where: { externalRef: input.externalRef },
    });
    if (existing) return existing.balanceAfter;

    const organization = await tx.organization.update({
      where: { id: input.organizationId },
      data: { creditBalance: { increment: input.amount } },
      select: { creditBalance: true },
    });

    await tx.creditLedger.create({
      data: {
        organizationId: input.organizationId,
        type: input.type ?? 'PLAN_GRANT',
        amount: input.amount,
        balanceAfter: organization.creditBalance,
        externalRef: input.externalRef,
        metadata: input.metadata,
      },
    });

    return organization.creditBalance;
  });
}
