import { decodeFastPairModel } from '@/scanner/fingerprint/fastPair';
import { FAST_PAIR_MODELS } from '@/scanner/fingerprint/fastPairModels.generated';

function serviceData(bytes: number[]): Record<string, string> {
  return { fe2c: Buffer.from(bytes).toString('base64') };
}

describe('decodeFastPairModel', () => {
  it('resolves a 3-byte model ID to a product name', () => {
    // 0x0000F0 — Bose QuietComfort 35 II, one of the registry's oldest IDs.
    expect(FAST_PAIR_MODELS['0000f0']).toBeDefined();
    expect(decodeFastPairModel(serviceData([0x00, 0x00, 0xf0]))).toBe(FAST_PAIR_MODELS['0000f0']);
  });

  it('ignores account-key-filter payloads (not 3 bytes)', () => {
    expect(decodeFastPairModel(serviceData([0x00, 0x40, 0x12, 0x34, 0x56]))).toBeUndefined();
  });

  it('ignores unknown model IDs and missing service data', () => {
    expect(decodeFastPairModel(serviceData([0xff, 0xff, 0xfe]))).toBeUndefined();
    expect(decodeFastPairModel(undefined)).toBeUndefined();
  });
});
