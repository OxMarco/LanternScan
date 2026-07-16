import { OUI_VENDORS } from '@/scanner/lan/ouiVendors.generated';
import { vendorFromMac } from '@/scanner/lan/ouiVendors';

// Pick a real entry from the generated table so the test tracks the dataset.
const [sampleOui, sampleVendor] = Object.entries(OUI_VENDORS)[0];

describe('vendorFromMac', () => {
  it('resolves a universally-administered MAC to its vendor', () => {
    const mac = `${sampleOui.slice(0, 2)}:${sampleOui.slice(2, 4)}:${sampleOui.slice(4, 6)}:11:22:33`;
    expect(vendorFromMac(mac)).toBe(sampleVendor);
  });

  it('is case- and separator-insensitive', () => {
    const lower = `${sampleOui.toLowerCase()}aabbcc`;
    expect(vendorFromMac(lower)).toBe(sampleVendor);
  });

  it('ignores locally-administered / masked addresses', () => {
    // iOS masks the BSSID as 02:00:00:00:00:00 (locally-administered bit set).
    expect(vendorFromMac('02:00:00:00:00:00')).toBeUndefined();
  });

  it('returns undefined for empty or too-short input', () => {
    expect(vendorFromMac(undefined)).toBeUndefined();
    expect(vendorFromMac('')).toBeUndefined();
    expect(vendorFromMac('ab:cd')).toBeUndefined();
  });
});
