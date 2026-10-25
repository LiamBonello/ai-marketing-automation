'use client';

import { useMemo, useState } from 'react';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import {
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type { CampaignPreview, MarketingChannel } from '@/domain/campaign';
import { demoCampaignResponse } from '@/data/demoCampaign';
import { mapCampaignResponse } from '@/mappers/campaignMapper';

interface Message {
  id: string;
  role: 'assistant' | 'user';
  text: string;
}

const starterPrompts = [
  'Promote a new product',
  'Get more bookings',
  'Create a weekly content plan',
] as const;

const initialMessages: Message[] = [
  {
    id: 'welcome',
    role: 'assistant',
    text: 'Tell me what you want to promote or achieve. I will prepare the campaign and only ask for details that actually matter.',
  },
];

function createAssistantResponse(input: string): string {
  const normalized = input.toLowerCase();

  if (normalized.includes('booking') || normalized.includes('restaurant') || normalized.includes('brunch')) {
    return 'I have prepared a booking-focused campaign using a clear offer and local-friendly call to action. You can choose where it goes before approving it.';
  }

  if (normalized.includes('product') || normalized.includes('sale')) {
    return 'I have turned that into a product promotion. I would normally confirm price, availability, and expiry before anything is published.';
  }

  return 'I have drafted a campaign from that request. You can edit it conversationally, switch channels on or off, and approve it when it looks right.';
}

export function AssistantWorkspace() {
  const mappedCampaign = useMemo(() => mapCampaignResponse(demoCampaignResponse), []);
  const [campaign, setCampaign] = useState<CampaignPreview>(mappedCampaign);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [approved, setApproved] = useState(false);

  const submitMessage = (message: string) => {
    const cleanMessage = message.trim();
    if (!cleanMessage) return;

    setMessages((current) => [
      ...current,
      { id: `user-${current.length}`, role: 'user', text: cleanMessage },
      {
        id: `assistant-${current.length + 1}`,
        role: 'assistant',
        text: createAssistantResponse(cleanMessage),
      },
    ]);
    setInput('');
    setShowPreview(true);
    setApproved(false);
  };

  const toggleChannel = (channelId: MarketingChannel) => {
    setCampaign((current) => ({
      ...current,
      channels: current.channels.map((channel) =>
        channel.id === channelId ? { ...channel, enabled: !channel.enabled } : channel,
      ),
    }));
    setApproved(false);
  };

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 5 }, px: { xs: 2, sm: 3, lg: 5 } }}>
      <Stack spacing={1} sx={{ mb: 4 }}>
        <Chip
          icon={<AutoAwesomeRoundedIcon />}
          label="AI marketing assistant"
          color="primary"
          variant="outlined"
          sx={{ alignSelf: 'flex-start', bgcolor: 'background.paper' }}
        />
        <Typography component="h1" variant="h2">
          What would you like to market today?
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 720 }}>
          Describe the outcome in normal language. MarketPilot prepares the campaign, adapts it for each channel, and keeps the technical settings out of your way.
        </Typography>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: showPreview ? 'minmax(0, 1.05fr) minmax(380px, 0.95fr)' : '1fr' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        <Paper
          variant="outlined"
          sx={{
            minHeight: { xs: 580, md: 650 },
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            borderColor: 'divider',
          }}
        >
          <Stack
            direction="row"
            sx={{
              px: 3,
              py: 2.2,
              borderBottom: 1,
              borderColor: 'divider',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 750 }}>Campaign workspace</Typography>
              <Typography variant="caption" color="text.secondary">
                Demo business
              </Typography>
            </Box>
            <Chip size="small" label="Ready" color="success" variant="outlined" />
          </Stack>

          <Stack spacing={2} sx={{ flexGrow: 1, p: { xs: 2, sm: 3 }, overflowY: 'auto' }}>
            {messages.map((message) => (
              <Box
                key={message.id}
                sx={{
                  alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    px: 2,
                    py: 1.5,
                    bgcolor: message.role === 'user' ? 'primary.main' : '#F2F4F7',
                    color: message.role === 'user' ? 'primary.contrastText' : 'text.primary',
                    borderRadius: message.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  }}
                >
                  <Typography variant="body2" sx={{ lineHeight: 1.55 }}>
                    {message.text}
                  </Typography>
                </Paper>
              </Box>
            ))}

            {!showPreview && (
              <Stack direction="row" spacing={1} useFlexGap sx={{ pt: 1, flexWrap: 'wrap' }}>
                {starterPrompts.map((prompt) => (
                  <Chip key={prompt} label={prompt} onClick={() => submitMessage(prompt)} clickable />
                ))}
              </Stack>
            )}
          </Stack>

          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submitMessage(input);
                }
              }}
              placeholder="Example: Promote our Sunday brunch and get more bookings"
              aria-label="Campaign request"
              slotProps={{
                input: {
                  endAdornment: (
                    <IconButton
                      color="primary"
                      onClick={() => submitMessage(input)}
                      aria-label="Send campaign request"
                      disabled={!input.trim()}
                    >
                      <SendRoundedIcon />
                    </IconButton>
                  ),
                },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Press Enter to send. Nothing is published without approval.
            </Typography>
          </Box>
        </Paper>

        {showPreview && (
          <Card data-testid="campaign-preview" sx={{ overflow: 'hidden' }}>
            <Box
              sx={{
                minHeight: 250,
                p: 3,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                color: 'common.white',
                background:
                  'radial-gradient(circle at 85% 10%, rgba(255,255,255,0.24), transparent 24%), linear-gradient(145deg, #5B4CF0 0%, #7247D8 45%, #E57373 130%)',
              }}
            >
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Chip
                  icon={<ImageRoundedIcon />}
                  label="Creative preview"
                  sx={{ bgcolor: alpha('#FFFFFF', 0.16), color: 'common.white', backdropFilter: 'blur(10px)' }}
                />
                <Typography variant="caption" sx={{ opacity: 0.86 }}>
                  MarketPilot AI
                </Typography>
              </Stack>
              <Box>
                <Typography variant="h5" sx={{ maxWidth: 380 }}>
                  {campaign.offer}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, opacity: 0.88 }}>
                  {campaign.callToAction}
                </Typography>
              </Box>
            </Box>

            <CardContent sx={{ p: 3 }}>
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                    {campaign.objective.toUpperCase()}
                  </Typography>
                  <Typography variant="h6" sx={{ mt: 0.5 }}>
                    {campaign.title}
                  </Typography>
                  <Typography color="text.secondary" variant="body2" sx={{ mt: 1, lineHeight: 1.65 }}>
                    {campaign.caption}
                  </Typography>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 700 }}>
                    Publish to
                  </Typography>
                  <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    {campaign.channels.map((channel) => (
                      <FormControlLabel
                        key={channel.id}
                        control={
                          <Switch
                            checked={channel.enabled}
                            onChange={() => toggleChannel(channel.id)}
                            slotProps={{ input: { 'aria-label': `Toggle ${channel.label}` } }}
                          />
                        }
                        label={channel.label}
                        sx={{
                          m: 0,
                          px: 1,
                          py: 0.25,
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 2,
                        }}
                      />
                    ))}
                  </Stack>
                </Box>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Button fullWidth variant="outlined" startIcon={<CalendarMonthRoundedIcon />}>
                    Schedule
                  </Button>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={approved ? <CheckCircleRoundedIcon /> : undefined}
                    onClick={() => setApproved(true)}
                    color={approved ? 'success' : 'primary'}
                  >
                    {approved ? 'Approved' : 'Approve campaign'}
                  </Button>
                </Stack>

                {approved && (
                  <Paper
                    elevation={0}
                    sx={{ p: 1.5, bgcolor: 'success.50', border: 1, borderColor: 'success.100' }}
                  >
                    <Typography variant="body2" color="success.dark" sx={{ fontWeight: 650 }}>
                      Campaign approved. Publishing remains disabled in this foundation build until real social accounts are connected.
                    </Typography>
                  </Paper>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}
      </Box>
    </Container>
  );
}
