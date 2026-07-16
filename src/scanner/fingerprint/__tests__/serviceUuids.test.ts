import {
  normalizeServiceUuid,
  serviceDeviceHint,
  serviceName,
} from '@/scanner/fingerprint/serviceUuids';

describe('normalizeServiceUuid', () => {
  it('collapses full 128-bit standard UUIDs to their 16-bit key', () => {
    expect(normalizeServiceUuid('0000180D-0000-1000-8000-00805F9B34FB')).toBe('180d');
  });

  it('lowercases bare 16-bit UUIDs', () => {
    expect(normalizeServiceUuid('180D')).toBe('180d');
  });

  it('keeps vendor-specific 128-bit UUIDs verbatim (lowercased)', () => {
    const vendor = '12345678-1234-5678-1234-56789abcdef0';
    expect(normalizeServiceUuid(vendor)).toBe(vendor);
  });
});

describe('serviceName', () => {
  it('names a standard GATT service regardless of UUID form', () => {
    expect(serviceName('0000180d-0000-1000-8000-00805f9b34fb')).toBe('Heart Rate');
    expect(serviceName('180D')).toBe('Heart Rate');
  });

  it('returns undefined for unknown UUIDs', () => {
    expect(serviceName('ffff')).toBeUndefined();
  });
});

describe('serviceDeviceHint', () => {
  it('infers a device type from a discriminating service', () => {
    expect(serviceDeviceHint('180d')?.label).toMatch(/fitness/i);
  });

  it('has no hint for generic services like Battery', () => {
    // 180f = Battery Service — named but says nothing about device type.
    expect(serviceName('180f')).toBe('Battery Service');
    expect(serviceDeviceHint('180f')).toBeUndefined();
  });
});
