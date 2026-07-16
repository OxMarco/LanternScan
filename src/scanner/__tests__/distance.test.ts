import { createRssiSmoother, estimateDistanceMeters } from '@/scanner/distance';

describe('estimateDistanceMeters', () => {
  it('returns roughly 1 m when RSSI matches the calibrated TX power', () => {
    expect(estimateDistanceMeters(-59, -59)).toBeCloseTo(1, 1);
  });

  it('reports larger distances for weaker signals', () => {
    const near = estimateDistanceMeters(-60)!;
    const far = estimateDistanceMeters(-90)!;
    expect(far).toBeGreaterThan(near);
  });

  it('ignores invalid RSSI values', () => {
    expect(estimateDistanceMeters(0)).toBeUndefined();
    expect(estimateDistanceMeters(10)).toBeUndefined();
    expect(estimateDistanceMeters(Number.NaN)).toBeUndefined();
  });
});

describe('createRssiSmoother', () => {
  it('adopts the first reading verbatim', () => {
    expect(createRssiSmoother().next(-70)).toBe(-70);
  });

  it('dampens jitter between readings', () => {
    const smoother = createRssiSmoother();
    smoother.next(-70);
    const jumped = smoother.next(-40);
    // The estimate should move toward -40 but not all the way.
    expect(jumped).toBeGreaterThan(-70);
    expect(jumped).toBeLessThan(-40);
  });
});
