import { decodeXiaomiProduct } from '@/scanner/fingerprint/xiaomi';
import { XIAOMI_PRODUCTS } from '@/scanner/fingerprint/xiaomiProducts.generated';

describe('decodeXiaomiProduct', () => {
  it('reads the little-endian product ID after the frame control', () => {
    // 0x0576 — CGD1 alarm clock.
    expect(XIAOMI_PRODUCTS[0x0576]).toContain('CGD1');
    const payload = Buffer.from([0x30, 0x58, 0x76, 0x05, 0x01, 0x02]).toString('base64');
    expect(decodeXiaomiProduct({ fe95: payload })).toBe(XIAOMI_PRODUCTS[0x0576]);
  });

  it('ignores truncated payloads, unknown products, and missing data', () => {
    expect(
      decodeXiaomiProduct({ fe95: Buffer.from([0x30, 0x58]).toString('base64') })
    ).toBeUndefined();
    const unknown = Buffer.from([0x30, 0x58, 0xff, 0xff]).toString('base64');
    expect(decodeXiaomiProduct({ fe95: unknown })).toBeUndefined();
    expect(decodeXiaomiProduct(undefined)).toBeUndefined();
  });
});
