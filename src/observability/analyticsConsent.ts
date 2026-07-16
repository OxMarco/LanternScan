import { createPersistedSetting, type PersistedSettingCodec } from '@/lib/persistedSetting';

export type AnalyticsConsent = 'granted' | 'denied';

// Analytics must be an explicit opt-in. The production app currently ships
// without an analytics adapter, but keeping the safe default here prevents a
// future adapter from silently changing the app's privacy posture.
export const DEFAULT_ANALYTICS_CONSENT: AnalyticsConsent = 'denied';
export function decodeAnalyticsConsent(raw: string | null): AnalyticsConsent {
  return raw === 'granted' || raw === 'denied' ? raw : DEFAULT_ANALYTICS_CONSENT;
}

const codec: PersistedSettingCodec<AnalyticsConsent> = {
  decode: decodeAnalyticsConsent,
  encode: (value) => value,
};

export const analyticsConsentSetting = createPersistedSetting(
  'starter:analytics-consent:v1',
  DEFAULT_ANALYTICS_CONSENT,
  codec
);
