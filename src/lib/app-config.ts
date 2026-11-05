function configuredValue(name: string): string | null {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith('REPLACE_ME_')) return null;
  return value;
}

export function appUrl(): string {
  const configured = configuredValue('NEXT_PUBLIC_APP_URL');
  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('NEXT_PUBLIC_APP_URL is not configured.');
    }
    return 'http://localhost:3000';
  }

  const url = new URL(configured);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('NEXT_PUBLIC_APP_URL must use HTTP or HTTPS.');
  }
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('NEXT_PUBLIC_APP_URL must use HTTPS in production.');
  }

  return url.origin;
}

export function isDemoMode(): boolean {
  return process.env.MARKETPILOT_DEMO_MODE === 'true';
}

export function hasConfiguredEnv(...names: string[]): boolean {
  return names.every((name) => Boolean(configuredValue(name)));
}

export function requireEnv(name: string): string {
  const value = configuredValue(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}
