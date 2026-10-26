import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import { Box, Card, CardContent, Chip, Container, Stack, Typography } from '@mui/material';
import { AppShell } from '@/components/layout/AppShell';
import { listCampaigns } from '@/lib/campaigns';
import { requirePageContext } from '@/lib/page-context';

const demoCampaigns = [
  { id: '1', title: 'Sunday Brunch Promotion', status: 'READY', channels: ['Instagram', 'TikTok'], detail: 'Awaiting approval' },
  { id: '2', title: 'Autumn Menu Launch', status: 'SCHEDULED', channels: ['Instagram', 'Email'], detail: 'Friday at 10:00' },
  { id: '3', title: 'Weekend Reminder', status: 'PUBLISHED', channels: ['Instagram'], detail: 'Published 2 days ago' },
] as const;

function statusLabel(value: string): string {
  return value.toLowerCase().replace(/(^|_)([a-z])/g, (_match, prefix: string, letter: string) =>
    `${prefix ? ' ' : ''}${letter.toUpperCase()}`,
  );
}

export default async function CampaignsPage() {
  const context = await requirePageContext();
  const campaigns = context.demo
    ? demoCampaigns
    : (await listCampaigns(context.auth!)).map((campaign) => ({
        id: campaign.id,
        title: campaign.title,
        status: campaign.status,
        channels: campaign.channels.filter((channel) => channel.enabled).map((channel) => {
          if (channel.channel === 'INSTAGRAM') return 'Instagram';
          if (channel.channel === 'TIKTOK') return 'TikTok';
          if (channel.channel === 'EMAIL') return 'Email';
          return 'X';
        }),
        detail: campaign.scheduledFor
          ? `Scheduled ${campaign.scheduledFor.toLocaleString()}`
          : campaign.publishedAt
            ? `Published ${campaign.publishedAt.toLocaleString()}`
            : campaign.status === 'READY'
              ? 'Awaiting approval'
              : statusLabel(campaign.status),
      }));

  return (
    <AppShell identity={context.identity} demo={context.demo}>
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 5 }, px: { xs: 2, sm: 3, lg: 5 } }}>
        <Stack spacing={1} sx={{ mb: 4 }}>
          <Typography variant="h2">Campaigns</Typography>
          <Typography color="text.secondary">
            Everything the assistant has prepared, scheduled, or published.
          </Typography>
        </Stack>

        {campaigns.length === 0 ? (
          <Card>
            <CardContent sx={{ py: 6, textAlign: 'center' }}>
              <CampaignRoundedIcon color="action" sx={{ fontSize: 44 }} />
              <Typography variant="h6" sx={{ mt: 1 }}>No campaigns yet</Typography>
              <Typography color="text.secondary" variant="body2">
                Ask the assistant to create your first campaign.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={2}>
            {campaigns.map((campaign) => (
              <Card key={campaign.id}>
                <CardContent>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    sx={{ alignItems: { sm: 'center' } }}
                  >
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 2.5,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: 'color-mix(in srgb, var(--mui-palette-primary-main) 8%, transparent)',
                        color: 'primary.main',
                      }}
                    >
                      <CampaignRoundedIcon />
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography sx={{ fontWeight: 750 }}>{campaign.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {campaign.channels.length ? campaign.channels.join(', ') : 'No active channels'}
                      </Typography>
                    </Box>
                    <Stack spacing={0.5} sx={{ alignItems: { sm: 'flex-end' } }}>
                      <Chip size="small" label={statusLabel(campaign.status)} variant="outlined" />
                      <Typography variant="caption" color="text.secondary">{campaign.detail}</Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Container>
    </AppShell>
  );
}
