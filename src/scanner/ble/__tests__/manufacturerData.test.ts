import { parseCompanyId } from '@/scanner/ble/manufacturerData';

describe('parseCompanyId', () => {
  it('reads the little-endian company id from base64 manufacturer data', () => {
    // 0x004c (Apple) little-endian = bytes 4c 00, plus a payload byte.
    const base64 = Buffer.from([0x4c, 0x00, 0x10]).toString('base64');
    expect(parseCompanyId(base64)).toBe(0x004c);
  });

  it('returns undefined for empty or short data', () => {
    expect(parseCompanyId(null)).toBeUndefined();
    expect(parseCompanyId(undefined)).toBeUndefined();
    expect(parseCompanyId(Buffer.from([0x01]).toString('base64'))).toBeUndefined();
  });
});
