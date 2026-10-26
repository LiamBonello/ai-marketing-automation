function configuredValue(name: string): string | null {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith('REPLACE_ME_')) return null;
  return value;
}

export function appUrl(): string {
  return configuredValue('NEXT_PUBLIC_APP_URL') || 'http://localhost:3000';
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
