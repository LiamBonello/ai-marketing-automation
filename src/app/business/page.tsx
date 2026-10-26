import { Container, Stack, Typography } from '@mui/material';
import { AppShell } from '@/components/layout/AppShell';
import { BusinessSettings } from '@/features/business/BusinessSettings';
import { getDb } from '@/lib/db';
import { requirePageContext } from '@/lib/page-context';

export default async function BusinessPage() {
  const context = await requirePageContext();

  const data = context.demo
    ? {
        business: {
          name: 'Demo business',
          website: 'https://example.com',
          description: 'A demo hospitality business used for MarketPilot browser tests.',
          industry: 'Hospitality',
          tone: 'Friendly and clear',
          targetAudience: 'Local diners and weekend visitors',
          location: 'Malta',
          primaryGoal: 'More bookings',
          brandGuidelines: null,
          timezone: 'Europe/Malta',
        },
        connections: [],
        plan: 'growth',
        subscriptionStatus: 'ACTIVE',
        creditBalance: 350,
      }
    : await (async () => {
        const business = await getDb().business.findFirstOrThrow({
          where: {
            id: context.auth!.businessId,
            organizationId: context.auth!.organizationId,
          },
          include: {
            socialConnections: {
              select: {
                channel: true,
                displayName: true,
                status: true,
              },
            },
          },
        });

        const organization = await getDb().organization.findUniqueOrThrow({
          where: { id: context.auth!.organizationId },
          select: {
            creditBalance: true,
            subscription: {
              select: { plan: true, status: true },
            },
          },
        });

        return {
          business: {
            name: business.name,
            website: business.website,
            description: business.description,
            industry: business.industry,
            tone: business.tone,
            targetAudience: business.targetAudience,
            location: business.location,
            primaryGoal: business.primaryGoal,
            brandGuidelines: business.brandGuidelines,
            timezone: business.timezone,
          },
          connections: business.socialConnections,
          plan: organization.subscription?.plan ?? 'starter',
          subscriptionStatus: organization.subscription?.status ?? 'INCOMPLETE',
          creditBalance: organization.creditBalance,
        };
      })();

  return (
    <AppShell identity={context.identity} demo={context.demo}>
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 5 }, px: { xs: 2, sm: 3, lg: 5 } }}>
        <Stack spacing={1} sx={{ mb: 4 }}>
          <Typography variant="h2">My business</Typography>
          <Typography color="text.secondary">
            Brand context, connected channels, consented contacts, subscription, and credits.
          </Typography>
        </Stack>

        <BusinessSettings
          demo={context.demo}
          business={data.business}
          connections={data.connections}
          plan={data.plan}
          subscriptionStatus={data.subscriptionStatus}
          creditBalance={data.creditBalance}
        />
      </Container>
    </AppShell>
  );
}
