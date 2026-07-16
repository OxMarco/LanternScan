import { createPersistedSetting, type PersistedSettingCodec } from '@/lib/persistedSetting';
import type { DeviceGuess } from '@/scanner/types';

export type OnlineIdentificationPreference = 'enabled' | 'disabled';

// Device fingerprints can include hostnames and MAC addresses. Never send
// them off-device until the user has made an informed choice in Settings.
export const DEFAULT_ONLINE_IDENTIFICATION: OnlineIdentificationPreference = 'disabled';
export function decodeOnlineIdentification(raw: string | null): OnlineIdentificationPreference {
  return raw === 'enabled' || raw === 'disabled' ? raw : DEFAULT_ONLINE_IDENTIFICATION;
}

const codec: PersistedSettingCodec<OnlineIdentificationPreference> = {
  decode: decodeOnlineIdentification,
  encode: (value) => value,
};

export const onlineIdentificationSetting = createPersistedSetting(
  'lantern:online-identification:v1',
  DEFAULT_ONLINE_IDENTIFICATION,
  codec
);

// A generic category can be confident without being specific ("Printer",
// "Apple device"). Only suppress online enrichment when offline evidence has
// also established a family or model, or when the user supplied the identity.
export function isSpecificOfflineIdentity(guess: DeviceGuess | undefined): boolean {
  if (!guess) return false;
  if (guess.reason.includes('Identified by you')) return true;
  if (guess.confidence < 0.6) return false;
  if (guess.model && (guess.modelConfidence ?? 0) >= 0.6) return true;
  return Boolean(guess.family && (guess.familyConfidence ?? 0) >= 0.7);
}
