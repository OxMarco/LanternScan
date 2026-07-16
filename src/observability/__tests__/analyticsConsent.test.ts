import { decodeAnalyticsConsent, DEFAULT_ANALYTICS_CONSENT } from '../analyticsConsent';

describe('analytics consent', () => {
  it.each(['granted', 'denied'] as const)('accepts %s', (value) => {
    expect(decodeAnalyticsConsent(value)).toBe(value);
  });

  it('falls back to the default consent for invalid storage', () => {
    expect(DEFAULT_ANALYTICS_CONSENT).toBe('denied');
    expect(decodeAnalyticsConsent(null)).toBe(DEFAULT_ANALYTICS_CONSENT);
    expect(decodeAnalyticsConsent('yes')).toBe(DEFAULT_ANALYTICS_CONSENT);
  });
});
