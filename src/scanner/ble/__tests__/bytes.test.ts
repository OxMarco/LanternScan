import { bytesToHex, decodeBase64 } from '@/scanner/ble/bytes';

describe('decodeBase64', () => {
  it('decodes a payload', () => {
    const encoded = Buffer.from([0x4c, 0x00, 0x12, 0xff]).toString('base64');
    expect(Array.from(decodeBase64(encoded)!)).toEqual([0x4c, 0x00, 0x12, 0xff]);
  });

  it('handles padding and empty input', () => {
    expect(Array.from(decodeBase64(Buffer.from([1]).toString('base64'))!)).toEqual([1]);
    expect(decodeBase64('')).toBeUndefined();
    expect(decodeBase64(null)).toBeUndefined();
  });

  it('rejects malformed input', () => {
    expect(decodeBase64('not base64!!')).toBeUndefined();
  });
});

describe('bytesToHex', () => {
  it('renders lowercase zero-padded hex', () => {
    expect(bytesToHex(Uint8Array.from([0x00, 0x0f, 0xf0]))).toBe('000ff0');
  });
});
