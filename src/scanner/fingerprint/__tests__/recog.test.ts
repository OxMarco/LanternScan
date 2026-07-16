import {
  recogCookieLabels,
  recogDeviceInfoLabels,
  recogFaviconLabel,
  recogServerLabel,
  recogSshBannerLabel,
  recogWwwAuthLabel,
} from '@/scanner/fingerprint/recog';
import { RECOG_FAVICONS } from '@/scanner/fingerprint/recog.generated';

describe('recogDeviceInfoLabels', () => {
  it('resolves an exact Mac model from the device-info TXT record', () => {
    expect(recogDeviceInfoLabels({ model: 'MacBookPro18,3' })).toContain(
      'Apple MacBook Pro (14-Inch, M1, 2021)'
    );
  });

  it('resolves a macOS version and combines with other keys', () => {
    const labels = recogDeviceInfoLabels({ osxvers: '22', model: 'MacBookPro18,3' });
    expect(labels.length).toBe(2);
    expect(labels.join(' ')).toContain('Mac OS X');
  });

  it('returns nothing for unknown records', () => {
    expect(recogDeviceInfoLabels({ model: 'TotallyUnknown1,1' })).toEqual([]);
    expect(recogDeviceInfoLabels(undefined)).toEqual([]);
  });
});

describe('recogServerLabel', () => {
  it('identifies a Synology NAS from its Server header', () => {
    expect(recogServerLabel('Synology/DSM/7.1.1-42962')).toBe('Synology');
  });

  it('identifies a Hikvision camera web UI', () => {
    expect(recogServerLabel('Hikvision-Webs')).toBe('Hikvision');
  });

  it('returns undefined for unknown servers', () => {
    expect(recogServerLabel('TotallyUnknownServer/1.0')).toBeUndefined();
    expect(recogServerLabel(undefined)).toBeUndefined();
  });
});

describe('recogFaviconLabel', () => {
  it('resolves a known favicon hash regardless of case', () => {
    const [hash, label] = Object.entries(RECOG_FAVICONS)[0];
    expect(recogFaviconLabel(hash)).toBe(label);
    expect(recogFaviconLabel(hash.toUpperCase())).toBe(label);
  });

  it('returns undefined for unknown hashes', () => {
    expect(recogFaviconLabel('0'.repeat(32))).toBeUndefined();
    expect(recogFaviconLabel(undefined)).toBeUndefined();
  });
});

describe('additional Recog probes', () => {
  it('recognizes HTTP cookies and authentication realms', () => {
    expect(recogCookieLabels(['PHPSESSID=abc; Path=/'])).toContain('PHP');
    expect(recogWwwAuthLabel('Basic realm="APC Management Card"')).toBe('APC');
  });

  it('strips the SSH protocol prefix before matching a banner', () => {
    expect(recogSshBannerLabel('SSH-2.0-RomSShell_4.62')).toBe('Allegro Software RomSShell');
  });
});
