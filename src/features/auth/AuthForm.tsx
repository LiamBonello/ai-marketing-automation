'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import NextLink from 'next/link';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const register = mode === 'register';
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);

    const payload = register
      ? {
          name: String(formData.get('name') || ''),
          businessName: String(formData.get('businessName') || ''),
          email: String(formData.get('email') || ''),
          password: String(formData.get('password') || ''),
          acceptTerms: formData.get('acceptTerms') === 'on',
          acceptPrivacy: formData.get('acceptPrivacy') === 'on',
        }
      : {
          email: String(formData.get('email') || ''),
          password: String(formData.get('password') || ''),
        };

    try {
      const response = await fetch(`/api/auth/${register ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Authentication failed.');
      router.replace('/');
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Authentication failed.');
      setPending(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: 2,
        background:
          'radial-gradient(circle at 15% 10%, rgba(91,76,240,.12), transparent 30%), #F7F8FB',
      }}
    >
      <Paper sx={{ width: '100%', maxWidth: 460, p: { xs: 3, sm: 5 } }}>
        <Stack spacing={3}>
          <Stack direction="row" spacing={1.2} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2.5,
                display: 'grid',
                placeItems: 'center',
                color: 'common.white',
                background: 'linear-gradient(135deg, #5B4CF0, #8B5CF6)',
              }}
            >
              <AutoAwesomeRoundedIcon />
            </Box>
            <Typography variant="h6">MarketPilot</Typography>
          </Stack>

          <Box>
            <Typography variant="h4" sx={{ fontWeight: 760 }}>
              {register ? 'Create your workspace' : 'Welcome back'}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {register
                ? 'Start with 100 AI credits and build your first campaign.'
                : 'Sign in to manage campaigns, channels, and results.'}
            </Typography>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          <Box component="form" action={submit}>
            <Stack spacing={2}>
              {register && (
                <>
                  <TextField name="name" label="Your name" required autoComplete="name" />
                  <TextField name="businessName" label="Business name" required autoComplete="organization" />
                </>
              )}
              <TextField name="email" label="Email" type="email" required autoComplete="email" />
              <TextField
                name="password"
                label="Password"
                type="password"
                required
                autoComplete={register ? 'new-password' : 'current-password'}
                helperText={register ? 'Use at least 10 characters.' : undefined}
              />
              {register && (
                <Stack spacing={0.5}>
                  <FormControlLabel
                    control={<Checkbox name="acceptTerms" required />}
                    label={
                      <Typography variant="body2">
                        I agree to the <Link component={NextLink} href="/terms" target="_blank">Terms of Service</Link>.
                      </Typography>
                    }
                  />
                  <FormControlLabel
                    control={<Checkbox name="acceptPrivacy" required />}
                    label={
                      <Typography variant="body2">
                        I acknowledge the <Link component={NextLink} href="/privacy" target="_blank">Privacy Notice</Link>.
                      </Typography>
                    }
                  />
                </Stack>
              )}
              <Button type="submit" variant="contained" size="large" disabled={pending}>
                {pending ? <CircularProgress size={22} color="inherit" /> : register ? 'Create account' : 'Sign in'}
              </Button>
            </Stack>
          </Box>

          <Typography variant="body2" color="text.secondary">
            {register ? 'Already have an account? ' : 'New to MarketPilot? '}
            <Link component={NextLink} href={register ? '/login' : '/register'}>
              {register ? 'Sign in' : 'Create an account'}
            </Link>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
