import {
  globMatch,
  haBluetoothBrands,
  haHostnameBrand,
  haSsdpBrands,
  haZeroconfBrands,
} from '@/scanner/fingerprint/haRegistry';
import { HA_HOSTNAMES } from '@/scanner/fingerprint/haRegistry.generated';

describe('globMatch', () => {
  it('matches fnmatch-style globs case-insensitively', () => {
    expect(globMatch('appletv*', 'AppleTV6,2')).toBe(true);
    expect(globMatch('shelly?-*', 'shelly1-a4cf12')).toBe(true);
    expect(globMatch('appletv*', 'homepod1,1')).toBe(false);
  });

  it('escapes regex metacharacters in patterns', () => {
    expect(globMatch('e4:*', 'e4:f0:42')).toBe(true);
    expect(globMatch('a.b*', 'axb')).toBe(false);
  });
});

describe('haBluetoothBrands', () => {
  it('matches Bluetooth local-name discovery rules', () => {
    expect(haBluetoothBrands({ name: 'Govee_H5179_1234' })).toContain('Govee Bluetooth');
  });

  it('requires the manufacturer payload prefix when a rule declares one', () => {
    expect(
      haBluetoothBrands({
        manufacturerCompanyId: 0x004c,
        manufacturerData: Buffer.from([0x4c, 0x00, 0x06, 0x01]).toString('base64'),
      })
    ).toContain('HomeKit Device');
    expect(
      haBluetoothBrands({
        manufacturerCompanyId: 0x004c,
        manufacturerData: Buffer.from([0x4c, 0x00, 0x02, 0x15]).toString('base64'),
      })
    ).not.toContain('HomeKit Device');
  });
});

describe('haZeroconfBrands', () => {
  it('matches an AirPlay Apple TV via TXT properties', () => {
    const brands = haZeroconfBrands({
      mdnsServices: ['_airplay._tcp'],
      mdnsTxt: { model: 'AppleTV6,2' },
    });
    expect(brands).toContain('Apple TV');
  });

  it('does not match when the required TXT property is absent', () => {
    expect(haZeroconfBrands({ mdnsServices: ['_airplay._tcp'] })).not.toContain('Apple TV');
  });
});

describe('haSsdpBrands', () => {
  it('matches Roku when every rule field matches', () => {
    expect(
      haSsdpBrands({
        st: 'roku:ecp',
        manufacturer: 'Roku',
        deviceType: 'urn:roku-com:device:player:1-0',
      })
    ).toContain('Roku');
  });

  it('does not match when only part of a rule matches', () => {
    expect(haSsdpBrands({ st: 'roku:ecp' })).toEqual([]);
  });

  it('matches nothing without SSDP identity', () => {
    expect(haSsdpBrands(undefined)).toEqual([]);
  });
});

describe('haHostnameBrand', () => {
  it('matches a hostname pattern from the registry (ignoring .local)', () => {
    // Build a concrete hostname from whatever pattern ships in the registry so
    // the test does not pin upstream data.
    const [pattern, brand] = HA_HOSTNAMES[0];
    const hostname = `${pattern.replace(/\*/g, 'x1').replace(/\?/g, 'y')}.local`;
    expect(haHostnameBrand(hostname)).toBe(brand);
  });

  it('returns undefined for unknown hostnames', () => {
    expect(haHostnameBrand('completely-unknown-host-zzz')).toBeUndefined();
    expect(haHostnameBrand(undefined)).toBeUndefined();
  });
});
