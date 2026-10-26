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
        const aggregates = await getDb().campaignMetric.aggregate({
          where: {
            campaign: { businessId: context.auth!.businessId },
          },
          _sum: {
            reach: true,
            clicks: true,
            engagements: true,
          },
        });

        return [
          {
            label: 'People reached',
            value: compactNumber(aggregates._sum.reach ?? 0),
            detail: 'Across connected platform snapshots',
          },
          {
            label: 'Link clicks',
            value: compactNumber(aggregates._sum.clicks ?? 0),
            detail: 'Tracked platform clicks',
          },
          {
            label: 'Engagements',
            value: compactNumber(aggregates._sum.engagements ?? 0),
            detail: 'Likes, comments, and shares',
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
