import {
  correctionFor,
  correctionsSetting,
  fingerprintSimilarity,
  privacySafeFingerprint,
  saveCorrection,
} from '@/scanner/fingerprint/corrections';

describe('privacySafeFingerprint', () => {
  beforeEach(async () => {
    await correctionsSetting.set({});
  });

  it('does not create a shared fingerprint for a signal-less device', () => {
    expect(privacySafeFingerprint({})).toBe('');
  });

  it('does not retain network or user-specific identifiers', () => {
    const first = privacySafeFingerprint({
      ip: '192.168.1.20',
      mac: 'aa:bb:cc:dd:ee:ff',
      name: "Marco's speaker",
      hostname: 'living-room.local',
      manufacturerCompanyId: 76,
      serviceUUIDs: ['0000180a-0000-1000-8000-00805f9b34fb'],
    });
    const second = privacySafeFingerprint({
      ip: '10.0.0.9',
      mac: '11:22:33:44:55:66',
      name: "Someone else's speaker",
      hostname: 'speaker.local',
      manufacturerCompanyId: 76,
      serviceUUIDs: ['180a'],
    });
    expect(first).toBe(second);
    expect(first).not.toContain('Marco');
    expect(first).not.toContain('192.168');
  });

  it('matches a learned correction after additional signals are discovered', async () => {
    const early = {
      manufacturerCompanyId: 76,
      serviceUUIDs: ['180a'],
    };
    await saveCorrection(early, 'Kitchen iPhone');

    expect(
      correctionFor({
        ...early,
        serviceUUIDs: ['180a', '180f'],
        gatt: { manufacturer: 'Apple Inc.', modelNumber: 'iPhone10,4' },
      })
    ).toBe('Kitchen iPhone');
  });

  it('rejects corrections when a strong model identity conflicts', () => {
    const first = privacySafeFingerprint({
      gatt: { manufacturer: 'Apple', modelNumber: 'iPhone10,4' },
    });
    const second = privacySafeFingerprint({
      gatt: { manufacturer: 'Apple', modelNumber: 'iPhone15,4' },
    });
    expect(fingerprintSimilarity(first, second)).toBe(0);
  });

  it('does not match unrelated devices from a company identifier alone', () => {
    const first = privacySafeFingerprint({ manufacturerCompanyId: 76 });
    const second = privacySafeFingerprint({ manufacturerCompanyId: 76 });
    // Exact fingerprints remain usable, but fuzzy comparison requires more
    // than one generic dimension.
    expect(fingerprintSimilarity(first, second)).toBe(0);
  });

  it('does not apply a correction backed only by a broad company identifier', async () => {
    await saveCorrection({ manufacturerCompanyId: 76 }, 'Personal Apple device');
    expect(correctionFor({ manufacturerCompanyId: 76 })).toBeUndefined();
  });
});
