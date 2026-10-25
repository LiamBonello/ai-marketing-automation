import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import { alpha, Box, Card, CardContent, Chip, Container, Stack, Typography } from '@mui/material';
import { AppShell } from '@/components/layout/AppShell';

const campaigns = [
  { title: 'Sunday Brunch Promotion', status: 'Ready', channels: 'Instagram, TikTok', detail: 'Awaiting approval' },
  { title: 'Autumn Menu Launch', status: 'Scheduled', channels: 'Instagram, Email', detail: 'Friday at 10:00' },
  { title: 'Weekend Reminder', status: 'Published', channels: 'Instagram', detail: 'Published 2 days ago' },
] as const;

export default function CampaignsPage() {
  return (
    <AppShell>
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 5 }, px: { xs: 2, sm: 3, lg: 5 } }}>
        <Stack spacing={1} sx={{ mb: 4 }}>
          <Typography variant="h2">Campaigns</Typography>
          <Typography color="text.secondary">Everything the assistant has prepared, scheduled, or published.</Typography>
        </Stack>

        <Stack spacing={2}>
          {campaigns.map((campaign) => (
            <Card key={campaign.title}>
              <CardContent>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
                  <Box
                    sx={(theme) => ({
                      width: 44,
                      height: 44,
                      borderRadius: 2.5,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                      color: 'primary.main',
                    })}
                  >
                    <CampaignRoundedIcon />
                  </Box>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography sx={{ fontWeight: 750 }}>{campaign.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{campaign.channels}</Typography>
                  </Box>
                  <Stack spacing={0.5} sx={{ alignItems: { sm: 'flex-end' } }}>
                    <Chip size="small" label={campaign.status} variant="outlined" />
                    <Typography variant="caption" color="text.secondary">{campaign.detail}</Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Container>
    </AppShell>
  );
}
