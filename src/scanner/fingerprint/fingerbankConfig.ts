import Constants from 'expo-constants';

// The Fingerbank API key is injected at build time from the FINGERPRINTBANK_API_KEY
// env var (see app.config.ts → extra.fingerbankApiKey). When absent, online
// enrichment is unavailable and Lantern stays fully offline.
export function getFingerbankApiKey(): string | undefined {
  const raw = (Constants.expoConfig?.extra as { fingerbankApiKey?: unknown } | undefined)
    ?.fingerbankApiKey;
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}
