import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth';
import { isDemoMode } from '@/lib/app-config';
import { getDb } from '@/lib/db';

export interface PageContext {
  demo: boolean;
  identity: {
    name: string;
    businessName: string;
    planName: string;
    creditBalance: number;
  };
  auth: Awaited<ReturnType<typeof getAuthContext>>;
}

export async function requirePageContext(): Promise<PageContext> {
  if (isDemoMode()) {
    return {
      demo: true,
      auth: null,
      identity: {
        name: 'Demo user',
        businessName: 'Demo business',
        planName: 'Growth',
        creditBalance: 350,
      },
    };
  }

  const auth = await getAuthContext();
  if (!auth) redirect('/login');

  const organization = await getDb().organization.findUnique({
    where: { id: auth.organizationId },
    select: {
      creditBalance: true,
      subscription: { select: { plan: true } },
    },
  });

  return {
    demo: false,
    auth,
    identity: {
      name: auth.name,
      businessName: auth.businessName,
      planName: organization?.subscription?.plan ?? 'starter',
      creditBalance: organization?.creditBalance ?? 0,
    },
  };
}
