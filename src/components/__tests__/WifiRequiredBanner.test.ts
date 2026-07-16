import { needsWifiConnection } from '@/components/WifiRequiredBanner';

describe('needsWifiConnection', () => {
  it('does not warn on Wi-Fi or while the connection type is unresolved', () => {
    expect(needsWifiConnection('wifi')).toBe(false);
    expect(needsWifiConnection('unknown')).toBe(false);
  });

  it('warns when the phone is on cellular or has no connection', () => {
    expect(needsWifiConnection('cellular')).toBe(true);
    expect(needsWifiConnection('none')).toBe(true);
  });
});
