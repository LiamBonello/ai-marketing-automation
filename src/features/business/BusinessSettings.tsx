'use client';

import { useMemo, useState } from 'react';
import InstagramIcon from '@mui/icons-material/Instagram';
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded';
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded';
import AlternateEmailRoundedIcon from '@mui/icons-material/AlternateEmailRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { plans } from '@/lib/plans';

interface ConnectionView {
  channel: 'INSTAGRAM' | 'TIKTOK' | 'X' | 'EMAIL';
  displayName: string | null;
  status: string;
}

interface BusinessView {
  name: string;
  website: string | null;
  description: string | null;
  industry: string | null;
  tone: string | null;
  targetAudience: string | null;
  location: string | null;
  primaryGoal: string | null;
  brandGuidelines: string | null;
  timezone: string;
}

interface BusinessSettingsProps {
  demo: boolean;
  business: BusinessView;
  connections: ConnectionView[];
  plan: string;
  subscriptionStatus: string;
  creditBalance: number;
}

const channelMeta = {
  INSTAGRAM: { label: 'Instagram', provider: 'instagram', icon: <InstagramIcon color="action" /> },
  TIKTOK: { label: 'TikTok', provider: 'tiktok', icon: <MusicNoteRoundedIcon color="action" /> },
  X: { label: 'X', provider: 'x', icon: <AlternateEmailRoundedIcon color="action" /> },
  EMAIL: { label: 'Email', provider: null, icon: <MailOutlineRoundedIcon color="action" /> },
} as const;

async function responseJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

export function BusinessSettings({
  demo,
  business,
  connections,
  plan,
  subscriptionStatus,
  creditBalance,
}: BusinessSettingsProps) {
  const [form, setForm] = useState(business);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);
  const [contactsText, setContactsText] = useState('');
  const [contactsImporting, setContactsImporting] = useState(false);

  const connectionMap = useMemo(
    () => new Map(connections.map((connection) => [connection.channel, connection])),
    [connections],
  );

  function updateField<K extends keyof BusinessView>(key: K, value: BusinessView[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveProfile() {
    if (demo || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      await responseJson(
        await fetch('/api/business', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }),
      );
      setMessage({ severity: 'success', text: 'Business profile saved.' });
    } catch (error) {
      setMessage({ severity: 'error', text: error instanceof Error ? error.message : 'Save failed.' });
    } finally {
      setSaving(false);
    }
  }

  async function startCheckout(input: { type: 'plan'; plan: string } | { type: 'credits'; pack: string }) {
    if (demo) return;
    setMessage(null);
    try {
      const data = await responseJson<{ url: string }>(
        await fetch('/api/billing/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }),
      );
      window.location.assign(data.url);
    } catch (error) {
      setMessage({ severity: 'error', text: error instanceof Error ? error.message : 'Billing failed.' });
    }
  }

  async function openPortal() {
    if (demo) return;
    try {
      const data = await responseJson<{ url: string }>(
        await fetch('/api/billing/portal', { method: 'POST' }),
      );
      window.location.assign(data.url);
    } catch (error) {
      setMessage({ severity: 'error', text: error instanceof Error ? error.message : 'Billing portal failed.' });
    }
  }

  async function importContacts() {
    if (demo || contactsImporting) return;
    const lines = contactsText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const contacts = lines.map((line) => {
      const [email, firstName = '', lastName = ''] = line.split(',').map((part) => part.trim());
      return {
        email,
        firstName: firstName || null,
        lastName: lastName || null,
        consentSource: 'Manual import certified by account owner',
      };
    });

    if (!contacts.length) {
      setMessage({ severity: 'error', text: 'Add at least one contact.' });
      return;
    }

    setContactsImporting(true);
    setMessage(null);
    try {
      const data = await responseJson<{ imported: number }>(
        await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts }),
        }),
      );
      setContactsText('');
      setMessage({ severity: 'success', text: `${data.imported} contacts imported.` });
    } catch (error) {
      setMessage({ severity: 'error', text: error instanceof Error ? error.message : 'Import failed.' });
    } finally {
      setContactsImporting(false);
    }
  }

  return (
    <Stack spacing={3}>
      {message && <Alert severity={message.severity}>{message.text}</Alert>}

      <Card>
        <CardContent>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
          >
            <Box>
              <Typography variant="h6">Brand profile</Typography>
              <Typography variant="body2" color="text.secondary">
                This confirmed context is supplied to the campaign assistant.
              </Typography>
            </Box>
            <Button variant="contained" onClick={() => void saveProfile()} disabled={demo || saving}>
              {saving ? 'Saving...' : 'Save profile'}
            </Button>
          </Stack>
          <Divider sx={{ my: 2.5 }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
            <TextField
              label="Business name"
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
            />
            <TextField
              label="Website"
              value={form.website ?? ''}
              onChange={(event) => updateField('website', event.target.value || null)}
            />
            <TextField
              label="Industry"
              value={form.industry ?? ''}
              onChange={(event) => updateField('industry', event.target.value || null)}
            />
            <TextField
              label="Location"
              value={form.location ?? ''}
              onChange={(event) => updateField('location', event.target.value || null)}
            />
            <TextField
              label="Tone"
              value={form.tone ?? ''}
              onChange={(event) => updateField('tone', event.target.value || null)}
            />
            <TextField
              label="Primary goal"
              value={form.primaryGoal ?? ''}
              onChange={(event) => updateField('primaryGoal', event.target.value || null)}
            />
            <TextField
              label="Target audience"
              value={form.targetAudience ?? ''}
              onChange={(event) => updateField('targetAudience', event.target.value || null)}
              multiline
              minRows={2}
            />
            <TextField
              label="Business description"
              value={form.description ?? ''}
              onChange={(event) => updateField('description', event.target.value || null)}
              multiline
              minRows={2}
            />
            <TextField
              label="Brand guidelines"
              value={form.brandGuidelines ?? ''}
              onChange={(event) => updateField('brandGuidelines', event.target.value || null)}
              multiline
              minRows={3}
              sx={{ gridColumn: { md: '1 / -1' } }}
            />
            <TextField
              label="Timezone"
              value={form.timezone}
              onChange={(event) => updateField('timezone', event.target.value)}
            />
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6">Connected channels</Typography>
          <Typography variant="body2" color="text.secondary">
            Connect the business-owned professional accounts MarketPilot may publish to.
          </Typography>
          <Divider sx={{ my: 2.5 }} />
          <Stack spacing={1.5}>
            {(Object.keys(channelMeta) as Array<keyof typeof channelMeta>).map((channel) => {
              const meta = channelMeta[channel];
              const connection = connectionMap.get(channel);
              const configured = Boolean(connection);
              return (
                <Stack key={channel} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  {meta.icon}
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography>{meta.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {channel === 'EMAIL'
                        ? 'Uses your SMTP configuration and consented contact list.'
                        : connection?.displayName || (configured ? connection?.status : 'Not connected')}
                    </Typography>
                  </Box>
                  {channel === 'EMAIL' ? (
                    <Chip size="small" label="SMTP" variant="outlined" />
                  ) : configured ? (
                    <Chip size="small" color={connection?.status === 'READY' ? 'success' : 'warning'} label={connection?.status || 'Connected'} />
                  ) : (
                    <Button
                      component="a"
                      href={demo ? undefined : `/api/connections/${meta.provider}/start`}
                      variant="outlined"
                      size="small"
                      disabled={demo}
                    >
                      Connect
                    </Button>
                  )}
                </Stack>
              );
            })}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6">Subscription & credits</Typography>
              <Typography variant="body2" color="text.secondary">
                Current plan: {plan}. Status: {subscriptionStatus}. Available credits: {creditBalance}.
              </Typography>
            </Box>
            <Button variant="outlined" onClick={() => void openPortal()} disabled={demo}>Billing portal</Button>
          </Stack>
          <Divider sx={{ my: 2.5 }} />
          <TextField
            select
            fullWidth
            label="Change plan"
            value={plan}
            onChange={(event) => void startCheckout({ type: 'plan', plan: event.target.value })}
            disabled={demo}
          >
            {plans.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.name} — EUR {item.monthlyPriceEur}/month · {item.monthlyCredits} credits
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 2, flexWrap: 'wrap' }}>
            <Button variant="outlined" onClick={() => void startCheckout({ type: 'credits', pack: '100' })} disabled={demo}>+100 credits</Button>
            <Button variant="outlined" onClick={() => void startCheckout({ type: 'credits', pack: '300' })} disabled={demo}>+300 credits</Button>
            <Button variant="outlined" onClick={() => void startCheckout({ type: 'credits', pack: '1000' })} disabled={demo}>+1000 credits</Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6">Email contacts</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            One contact per line: email, first name, last name. Import only people who have consented to receive marketing from this business.
          </Typography>
          <Alert severity="warning" sx={{ my: 2 }}>
            By importing contacts, you confirm you have a lawful marketing basis and can evidence consent where required.
          </Alert>
          <TextField
            multiline
            minRows={5}
            fullWidth
            value={contactsText}
            onChange={(event) => setContactsText(event.target.value)}
            placeholder={'amy@example.com,Amy,Smith\nliam@example.com,Liam,Jones'}
            disabled={demo}
          />
          <Button
            sx={{ mt: 2 }}
            variant="contained"
            onClick={() => void importContacts()}
            disabled={demo || contactsImporting}
          >
            {contactsImporting ? 'Importing...' : 'Import contacts'}
          </Button>
        </CardContent>
      </Card>
    </Stack>
  );
}
