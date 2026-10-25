import InstagramIcon from '@mui/icons-material/Instagram';
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded';
import { Box, Button, Card, CardContent, Chip, Container, Divider, Stack, Typography } from '@mui/material';
import { AppShell } from '@/components/layout/AppShell';

export default function BusinessPage() {
  return (
    <AppShell>
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 5 }, px: { xs: 2, sm: 3, lg: 5 } }}>
        <Stack spacing={1} sx={{ mb: 4 }}>
          <Typography variant="h2">My business</Typography>
          <Typography color="text.secondary">Brand context, connected channels, and subscription settings live here.</Typography>
        </Stack>

        <Stack spacing={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Brand profile</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Demo business profile used by the assistant during the foundation build.
              </Typography>
              <Divider sx={{ my: 2.5 }} />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
                <Box><Typography variant="caption" color="text.secondary">Tone</Typography><Typography sx={{ fontWeight: 650 }}>Friendly and clear</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Primary goal</Typography><Typography sx={{ fontWeight: 650 }}>More bookings</Typography></Box>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h6">Connected channels</Typography>
                  <Typography variant="body2" color="text.secondary">OAuth connections will be added in the integration phase.</Typography>
                </Box>
                <Button variant="outlined">Connect channel</Button>
              </Stack>
              <Divider sx={{ my: 2.5 }} />
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}><InstagramIcon color="action" /><Typography sx={{ flexGrow: 1 }}>Instagram</Typography><Chip size="small" label="Not connected" /></Stack>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}><MailOutlineRoundedIcon color="action" /><Typography sx={{ flexGrow: 1 }}>Email</Typography><Chip size="small" label="Not connected" /></Stack>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h6">Growth plan</Typography>
                  <Typography variant="body2" color="text.secondary">EUR49/month concept pricing. Billing is not active in this build.</Typography>
                </Box>
                <Button variant="contained">Manage plan</Button>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </AppShell>
  );
}
