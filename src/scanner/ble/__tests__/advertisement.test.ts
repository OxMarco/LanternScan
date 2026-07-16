import { parseAppearance } from '@/scanner/ble/advertisement';

function record(...structures: number[][]): string {
  return Buffer.from(structures.flat()).toString('base64');
}

describe('parseAppearance', () => {
  it('extracts the appearance value from a raw scan record', () => {
    // Flags structure, then Appearance (0x19) = 194 (Watch / Smartwatch).
    const raw = record([0x02, 0x01, 0x06], [0x03, 0x19, 0xc2, 0x00]);
    expect(parseAppearance(raw)).toBe(194);
  });

  it('returns undefined when no appearance structure is present', () => {
    expect(parseAppearance(record([0x02, 0x01, 0x06]))).toBeUndefined();
  });

  it('stops at a zero-length terminator without looping', () => {
    const raw = record([0x02, 0x01, 0x06], [0x00, 0x00, 0x00]);
    expect(parseAppearance(raw)).toBeUndefined();
  });

  it('tolerates missing input', () => {
    expect(parseAppearance(null)).toBeUndefined();
  });
});
