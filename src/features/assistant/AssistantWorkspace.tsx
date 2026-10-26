'use client';

import { useMemo, useState } from 'react';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import UploadRoundedIcon from '@mui/icons-material/UploadRounded';
import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import {
  mapCampaignResponse,
  mapLiveCampaign,
  type LiveCampaignApiResponse,
} from '@/mappers/campaignMapper';

interface Message {
  id: string;
  role: 'assistant' | 'user';
  text: string;
}

interface AssistantWorkspaceProps {
  mode: 'demo' | 'live';
  businessName: string;
  creditBalance?: number;
}

const starterPrompts = [
  'Promote a new product',
  'Get more bookings',
  'Create a weekly content plan',
] as const;

function initialMessages(businessName: string): Message[] {
  return [
    {
      id: 'welcome',
      role: 'assistant',
      text: `Tell me what you want to promote or achieve for ${businessName}. I will prepare the campaign and only ask for details that actually matter.`,
    },
  ];
}

function demoAssistantResponse(input: string): string {
  const normalized = input.toLowerCase();
  if (normalized.includes('booking') || normalized.includes('restaurant') || normalized.includes('brunch')) {
    return 'I have prepared a booking-focused campaign using a clear offer and local-friendly call to action. You can choose where it goes before approving it.';
  }
  if (normalized.includes('product') || normalized.includes('sale')) {
    return 'I have turned that into a product promotion. I would normally confirm price, availability, and expiry before anything is published.';
  }
  return 'I have drafted a campaign from that request. You can edit it, switch channels on or off, and approve it when it looks right.';
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

export function AssistantWorkspace({
  mode,
  businessName,
  creditBalance,
}: AssistantWorkspaceProps) {
  const demoCampaign = useMemo(() => mapCampaignResponse(demoCampaignResponse), []);
  const [campaign, setCampaign] = useState<CampaignPreview>(demoCampaign);
  const [messages, setMessages] = useState<Message[]>(() => initialMessages(businessName));
  const [input, setInput] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleValue, setScheduleValue] = useState('');

  const approved = ['approved', 'scheduled', 'publishing', 'published'].includes(campaign.status);
  const mediaUrl = campaign.channels.find((channel) => channel.mediaUrl)?.mediaUrl ?? null;

  async function submitMessage(message: string) {
    const cleanMessage = message.trim();
    if (!cleanMessage || pendingAction) return;

    setError(null);
    setMessages((current) => [
      ...current,
      { id: `user-${current.length}`, role: 'user', text: cleanMessage },
    ]);
    setInput('');
    setPendingAction('generate');

    try {
      if (mode === 'demo') {
        setMessages((current) => [
          ...current,
          {
            id: `assistant-${current.length}`,
            role: 'assistant',
            text: demoAssistantResponse(cleanMessage),
          },
        ]);
        setCampaign(demoCampaign);
      } else {
        const revising = showPreview && !campaign.id.startsWith('cmp_demo_');
        const endpoint = revising
          ? `/api/campaigns/${campaign.id}/revise`
          : '/api/campaigns';
        const payload = revising
          ? { instruction: cleanMessage }
          : { request: cleanMessage };

        const data = await readJson<{ campaign: LiveCampaignApiResponse }>(
          await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
        );
        setCampaign(mapLiveCampaign(data.campaign));
        setMessages((current) => [
          ...current,
          {
            id: `assistant-${current.length}`,
            role: 'assistant',
            text: revising
              ? 'I updated the current campaign and created a new version. Review it again before approving.'
              : 'Your campaign is ready. Review the creative and channels, then approve it when you are satisfied.',
          },
        ]);
      }
      setShowPreview(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Campaign generation failed.');
    } finally {
      setPendingAction(null);
    }
  }

  async function toggleChannel(channelId: MarketingChannel) {
    if (pendingAction) return;
    const target = campaign.channels.find((channel) => channel.id === channelId);
    if (!target) return;

    if (mode === 'demo') {
      setCampaign((current) => ({
        ...current,
        status: 'ready',
        channels: current.channels.map((channel) =>
          channel.id === channelId ? { ...channel, enabled: !channel.enabled } : channel,
        ),
      }));
      return;
    }

    setPendingAction(`channel-${channelId}`);
    setError(null);
    try {
      const data = await readJson<{ campaign: LiveCampaignApiResponse }>(
        await fetch(`/api/campaigns/${campaign.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: channelId.toUpperCase(),
            enabled: !target.enabled,
          }),
        }),
      );
      setCampaign(mapLiveCampaign(data.campaign));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Channel update failed.');
    } finally {
      setPendingAction(null);
    }
  }

  async function approve() {
    if (pendingAction) return;
    if (mode === 'demo') {
      setCampaign((current) => ({ ...current, status: 'approved' }));
      return;
    }

    setPendingAction('approve');
    setError(null);
    try {
      const data = await readJson<{ campaign: LiveCampaignApiResponse }>(
        await fetch(`/api/campaigns/${campaign.id}/approve`, { method: 'POST' }),
      );
      setCampaign(mapLiveCampaign(data.campaign));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Approval failed.');
    } finally {
      setPendingAction(null);
    }
  }

  async function scheduleCampaign() {
    if (!scheduleValue || pendingAction || mode === 'demo') return;
    const date = new Date(scheduleValue);
    if (!Number.isFinite(date.getTime())) {
      setError('Choose a valid schedule date and time.');
      return;
    }

    setPendingAction('schedule');
    setError(null);
    try {
      const data = await readJson<{ campaign: LiveCampaignApiResponse }>(
        await fetch(`/api/campaigns/${campaign.id}/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduledFor: date.toISOString() }),
        }),
      );
      setCampaign(mapLiveCampaign(data.campaign));
      setScheduleOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Scheduling failed.');
    } finally {
      setPendingAction(null);
    }
  }

  async function generateImage() {
    if (mode === 'demo' || pendingAction) return;
    setPendingAction('image');
    setError(null);
    try {
      const data = await readJson<{ mediaUrl: string }>(
        await fetch(`/api/campaigns/${campaign.id}/media`, { method: 'POST' }),
      );
      setCampaign((current) => ({
        ...current,
        status: 'ready',
        channels: current.channels.map((channel) =>
          channel.id === 'instagram' || channel.id === 'tiktok'
            ? { ...channel, mediaUrl: data.mediaUrl }
            : channel,
        ),
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Image generation failed.');
    } finally {
      setPendingAction(null);
    }
  }

  async function uploadMedia(file: File) {
    if (mode === 'demo' || pendingAction) return;
    setPendingAction('upload');
    setError(null);
    try {
      const presign = await readJson<{ uploadUrl: string; publicUrl: string }>(
        await fetch('/api/media/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contentType: file.type, fileSize: file.size }),
        }),
      );

      const uploadResponse = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error('Media upload failed.');

      await readJson<{ mediaUrl: string }>(
        await fetch(`/api/campaigns/${campaign.id}/media`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaUrl: presign.publicUrl }),
        }),
      );

      setCampaign((current) => ({
        ...current,
        status: 'ready',
        channels: current.channels.map((channel) =>
          channel.id === 'instagram' || channel.id === 'tiktok'
            ? { ...channel, mediaUrl: presign.publicUrl }
            : channel,
        ),
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Media upload failed.');
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 5 }, px: { xs: 2, sm: 3, lg: 5 } }}>
      <Stack spacing={1} sx={{ mb: 4 }}>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Chip
            icon={<AutoAwesomeRoundedIcon />}
            label="AI marketing assistant"
            color="primary"
            variant="outlined"
            sx={{ bgcolor: 'background.paper' }}
          />
          {mode === 'live' && typeof creditBalance === 'number' && (
            <Chip label={`${creditBalance} AI credits`} variant="outlined" />
          )}
        </Stack>
        <Typography component="h1" variant="h2">
          What would you like to market today?
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 720 }}>
          Describe the outcome in normal language. MarketPilot prepares the campaign, adapts it for each channel, and keeps the technical settings out of your way.
        </Typography>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

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
              <Typography variant="caption" color="text.secondary">{businessName}</Typography>
            </Box>
            <Chip
              size="small"
              label={pendingAction === 'generate' ? 'Generating' : 'Ready'}
              color={pendingAction === 'generate' ? 'primary' : 'success'}
              variant="outlined"
            />
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
                  <Typography variant="body2" sx={{ lineHeight: 1.55 }}>{message.text}</Typography>
                </Paper>
              </Box>
            ))}

            {pendingAction === 'generate' && (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <CircularProgress size={18} />
                <Typography variant="body2" color="text.secondary">Building your campaign...</Typography>
              </Stack>
            )}

            {!showPreview && !pendingAction && (
              <Stack direction="row" spacing={1} useFlexGap sx={{ pt: 1, flexWrap: 'wrap' }}>
                {starterPrompts.map((prompt) => (
                  <Chip key={prompt} label={prompt} onClick={() => void submitMessage(prompt)} clickable />
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
              disabled={pendingAction === 'generate'}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void submitMessage(input);
                }
              }}
              placeholder="Example: Promote our Sunday brunch and get more bookings"
              slotProps={{
                htmlInput: { 'aria-label': 'Campaign request' },
                input: {
                  endAdornment: (
                    <IconButton
                      color="primary"
                      onClick={() => void submitMessage(input)}
                      aria-label="Send campaign request"
                      disabled={!input.trim() || Boolean(pendingAction)}
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
                background: mediaUrl
                  ? `linear-gradient(rgba(17,19,35,.18), rgba(17,19,35,.35)), url("${mediaUrl}") center/cover`
                  : 'radial-gradient(circle at 85% 10%, rgba(255,255,255,0.24), transparent 24%), linear-gradient(145deg, #5B4CF0 0%, #7247D8 45%, #E57373 130%)',
              }}
            >
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Chip
                  icon={<ImageRoundedIcon />}
                  label={mediaUrl ? 'Campaign media' : 'Creative preview'}
                  sx={{ bgcolor: alpha('#FFFFFF', 0.16), color: 'common.white', backdropFilter: 'blur(10px)' }}
                />
                <Typography variant="caption" sx={{ opacity: 0.86 }}>MarketPilot AI</Typography>
              </Stack>
              <Box>
                <Typography variant="h5" sx={{ maxWidth: 380 }}>
                  {campaign.offer || campaign.title}
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
                  <Typography variant="h6" sx={{ mt: 0.5 }}>{campaign.title}</Typography>
                  <Typography color="text.secondary" variant="body2" sx={{ mt: 1, lineHeight: 1.65 }}>
                    {campaign.caption}
                  </Typography>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 700 }}>Publish to</Typography>
                  <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    {campaign.channels.map((channel) => (
                      <FormControlLabel
                        key={channel.id}
                        control={
                          <Switch
                            checked={channel.enabled}
                            disabled={Boolean(pendingAction)}
                            onChange={() => void toggleChannel(channel.id)}
                            slotProps={{ input: { 'aria-label': `Toggle ${channel.label}` } }}
                          />
                        }
                        label={channel.label}
                        sx={{ m: 0, px: 1, py: 0.25, border: 1, borderColor: 'divider', borderRadius: 2 }}
                      />
                    ))}
                  </Stack>
                </Box>

                {mode === 'live' && (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<AutoAwesomeRoundedIcon />}
                      disabled={Boolean(pendingAction)}
                      onClick={() => void generateImage()}
                    >
                      {pendingAction === 'image' ? 'Generating...' : 'Generate image'}
                    </Button>
                    <Button
                      fullWidth
                      component="label"
                      variant="outlined"
                      startIcon={<UploadRoundedIcon />}
                      disabled={Boolean(pendingAction)}
                    >
                      {pendingAction === 'upload' ? 'Uploading...' : 'Upload media'}
                      <input
                        hidden
                        type="file"
                        accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadMedia(file);
                          event.target.value = '';
                        }}
                      />
                    </Button>
                  </Stack>
                )}

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<CalendarMonthRoundedIcon />}
                    disabled={mode === 'demo' || !approved || Boolean(pendingAction)}
                    onClick={() => setScheduleOpen(true)}
                  >
                    {campaign.status === 'scheduled' ? 'Scheduled' : 'Schedule'}
                  </Button>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={approved ? <CheckCircleRoundedIcon /> : undefined}
                    onClick={() => void approve()}
                    disabled={Boolean(pendingAction) || campaign.status === 'published'}
                    color={approved ? 'success' : 'primary'}
                  >
                    {pendingAction === 'approve' ? 'Approving...' : approved ? 'Approved' : 'Approve campaign'}
                  </Button>
                </Stack>

                {approved && mode === 'demo' && (
                  <Paper elevation={0} sx={{ p: 1.5, bgcolor: 'rgba(21,163,125,.08)', border: 1, borderColor: 'rgba(21,163,125,.24)' }}>
                    <Typography variant="body2" color="success.dark" sx={{ fontWeight: 650 }}>
                      Campaign approved. Publishing remains disabled in demo mode.
                    </Typography>
                  </Paper>
                )}

                {campaign.status === 'scheduled' && campaign.scheduledFor && (
                  <Alert severity="success">
                    Scheduled for {new Date(campaign.scheduledFor).toLocaleString()}.
                  </Alert>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}
      </Box>

      <Dialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Schedule campaign</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            type="datetime-local"
            value={scheduleValue}
            onChange={(event) => setScheduleValue(event.target.value)}
            sx={{ mt: 1 }}
            slotProps={{ inputLabel: { shrink: true } }}
            label="Publish date and time"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void scheduleCampaign()} disabled={!scheduleValue || Boolean(pendingAction)}>
            Schedule
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
