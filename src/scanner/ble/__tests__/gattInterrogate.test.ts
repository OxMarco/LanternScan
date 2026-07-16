import { __testables } from '@/scanner/ble/gattInterrogate';

const { decodeUtf8 } = __testables;

// Base64 of the given bytes (mirrors what ble-plx returns for a characteristic).
function b64(...bytes: number[]): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return Buffer.from(binary, 'binary').toString('base64');
}

describe('decodeUtf8', () => {
  it('decodes an ASCII characteristic value', () => {
    expect(decodeUtf8(b64(0x47, 0x61, 0x72, 0x6d, 0x69, 0x6e))).toBe('Garmin');
  });

  it('stops at a NUL terminator and trims', () => {
    expect(decodeUtf8(b64(0x41, 0x42, 0x20, 0x00, 0x43))).toBe('AB');
  });

  it('decodes multi-byte UTF-8', () => {
    // "é" (U+00E9) = 0xC3 0xA9
    expect(decodeUtf8(b64(0x63, 0x61, 0x66, 0xc3, 0xa9))).toBe('café');
  });

  it('returns undefined for empty or nullish input', () => {
    expect(decodeUtf8(null)).toBeUndefined();
    expect(decodeUtf8('')).toBeUndefined();
    expect(decodeUtf8(b64(0x00))).toBeUndefined();
  });
});
