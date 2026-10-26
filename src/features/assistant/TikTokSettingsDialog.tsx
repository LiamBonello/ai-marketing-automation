'use client';

import { useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

interface TikTokCreatorInfo {
  creatorNickname: string;
  privacyLevelOptions: string[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoPostDurationSec: number | null;
}

interface TikTokSettingsResponse {
  creator: TikTokCreatorInfo;
  saved: {
    privacyLevel: string | null;
    allowComment: boolean;
    allowDuet: boolean;
    allowStitch: boolean;
    consented: boolean;
    title: string;
  };
}

interface TikTokSettingsDialogProps {
  campaignId: string;
  disabled?: boolean;
  onSaved?: () => void;
}

async function json<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

export function TikTokSettingsDialog({
  campaignId,
  disabled = false,
  onSaved,
}: TikTokSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creator, setCreator] = useState<TikTokCreatorInfo | null>(null);
  const [privacyLevel, setPrivacyLevel] = useState('');
  const [title, setTitle] = useState('');
  const [allowComment, setAllowComment] = useState(false);
  const [allowDuet, setAllowDuet] = useState(false);
  const [allowStitch, setAllowStitch] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openDialog() {
    if (disabled) return;
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const data = await json<TikTokSettingsResponse>(
        await fetch(`/api/campaigns/${campaignId}/tiktok-settings`, { cache: 'no-store' }),
      );
      setCreator(data.creator);
      setPrivacyLevel(data.saved.privacyLevel || '');
      setTitle(data.saved.title);
      setAllowComment(data.saved.allowComment);
      setAllowDuet(data.saved.allowDuet);
      setAllowStitch(data.saved.allowStitch);
      setConsent(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'TikTok settings could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!creator || !privacyLevel || !consent || !title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await json<{ ok: true }>(
        await fetch(`/api/campaigns/${campaignId}/tiktok-settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            privacyLevel,
            title: title.trim(),
            allowComment,
            allowDuet,
            allowStitch,
            consent: true,
          }),
        }),
      );
      setOpen(false);
      onSaved?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'TikTok settings could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="outlined" onClick={() => void openDialog()} disabled={disabled}>
        TikTok settings
      </Button>
      <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Post to TikTok</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {loading ? (
              <Typography color="text.secondary">Loading current TikTok creator settings...</Typography>
            ) : creator ? (
              <>
                <Alert severity="info">
                  Posting as {creator.creatorNickname}. TikTok may take several minutes to process a post after it is sent.
                </Alert>
                <TextField
                  label="TikTok caption"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  multiline
                  minRows={3}
                  inputProps={{ maxLength: 2200 }}
                  helperText={`${title.length}/2200`}
                />
                <FormControl fullWidth required>
                  <InputLabel id="tiktok-privacy-label">Privacy</InputLabel>
                  <Select
                    labelId="tiktok-privacy-label"
                    label="Privacy"
                    value={privacyLevel}
                    onChange={(event) => setPrivacyLevel(event.target.value)}
                  >
                    {creator.privacyLevelOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option.replaceAll('_', ' ').toLowerCase()}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Stack>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={allowComment}
                        onChange={(event) => setAllowComment(event.target.checked)}
                        disabled={creator.commentDisabled}
                      />
                    }
                    label="Allow comments"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={allowDuet}
                        onChange={(event) => setAllowDuet(event.target.checked)}
                        disabled={creator.duetDisabled}
                      />
                    }
                    label="Allow Duet"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={allowStitch}
                        onChange={(event) => setAllowStitch(event.target.checked)}
                        disabled={creator.stitchDisabled}
                      />
                    }
                    label="Allow Stitch"
                  />
                </Stack>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={consent}
                      onChange={(event) => setConsent(event.target.checked)}
                    />
                  }
                  label="I have reviewed these TikTok settings and expressly consent to MarketPilot sending this content to TikTok when the campaign is published."
                />
              </>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => void save()}
            disabled={
              loading ||
              saving ||
              !creator ||
              !privacyLevel ||
              !title.trim() ||
              !consent
            }
          >
            {saving ? 'Saving...' : 'Confirm TikTok settings'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
