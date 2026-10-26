import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import { Box, Card, CardContent, Container, Stack, Typography } from '@mui/material';
import { AppShell } from '@/components/layout/AppShell';
import { getDb } from '@/lib/db';
import { requirePageContext } from '@/lib/page-context';

function compactNumber(value: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export default async function ResultsPage() {
  const context = await requirePageContext();

  const metrics = context.demo
    ? [
        { label: 'People reached', value: '12.4K', detail: 'Across published campaigns' },
        { label: 'Link clicks', value: '196', detail: 'Tracked platform clicks' },
        { label: 'Engagements', value: '1.3K', detail: 'Likes, comments, and shares' },
      ]
    : await (async () => {
        const snapshots = await getDb().campaignMetric.findMany({
          where: {
            campaign: { businessId: context.auth!.businessId },
          },
          orderBy: { measuredAt: 'desc' },
          take: 2000,
        });

        const latest = new Map<string, (typeof snapshots)[number]>();
        for (const snapshot of snapshots) {
          const key = `${snapshot.campaignId}:${snapshot.channel}`;
          if (!latest.has(key)) latest.set(key, snapshot);
        }

        let reach = 0;
        let clicks = 0;
        let engagements = 0;
        for (const snapshot of latest.values()) {
          reach += snapshot.reach;
          clicks += snapshot.clicks;
          engagements += snapshot.engagements;
        }

        return [
          {
            label: 'People reached',
            value: compactNumber(reach),
            detail: 'Latest available platform snapshots',
          },
          {
            label: 'Link clicks',
            value: compactNumber(clicks),
            detail: 'Latest tracked platform clicks',
          },
          {
            label: 'Engagements',
            value: compactNumber(engagements),
            detail: 'Latest likes, comments, and shares',
          },
        ];
      })();

  return (
    <AppShell identity={context.identity} demo={context.demo}>
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 5 }, px: { xs: 2, sm: 3, lg: 5 } }}>
        <Stack spacing={1} sx={{ mb: 4 }}>
          <Typography variant="h2">Results</Typography>
          <Typography color="text.secondary">
            Performance from connected platform data. Values remain zero until metrics are ingested.
          </Typography>
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
          {metrics.map((metric) => (
            <Card key={metric.label}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">{metric.label}</Typography>
                <Typography variant="h4" sx={{ mt: 1, fontWeight: 760 }}>{metric.value}</Typography>
                <Stack direction="row" spacing={0.5} sx={{ mt: 1, color: 'text.secondary', alignItems: 'center' }}>
                  <ArrowUpwardRoundedIcon fontSize="small" />
                  <Typography variant="body2">{metric.detail}</Typography>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Container>
    </AppShell>
  );
}
