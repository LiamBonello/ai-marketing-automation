import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import { Box, Card, CardContent, Container, Stack, Typography } from '@mui/material';
import { AppShell } from '@/components/layout/AppShell';

const metrics = [
  { label: 'People reached', value: '12.4k', change: '+18%' },
  { label: 'Profile visits', value: '842', change: '+11%' },
  { label: 'Link clicks', value: '196', change: '+24%' },
] as const;

export default function ResultsPage() {
  return (
    <AppShell>
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 5 }, px: { xs: 2, sm: 3, lg: 5 } }}>
        <Stack spacing={1} sx={{ mb: 4 }}>
          <Typography variant="h2">Results</Typography>
          <Typography color="text.secondary">Plain-language performance summaries. Demo data only until platform analytics are connected.</Typography>
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
          {metrics.map((metric) => (
            <Card key={metric.label}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">{metric.label}</Typography>
                <Typography variant="h4" sx={{ mt: 1, fontWeight: 760 }}>{metric.value}</Typography>
                <Stack direction="row" spacing={0.5} sx={{ mt: 1, color: 'success.main', alignItems: 'center' }}>
                  <ArrowUpwardRoundedIcon fontSize="small" />
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{metric.change}</Typography>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Container>
    </AppShell>
  );
}
