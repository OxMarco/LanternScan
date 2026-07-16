import { appearanceName } from '@/scanner/fingerprint/appearance';

describe('appearanceName', () => {
  it('names an exact subcategory value', () => {
    // Watch category 3, subcategory 2 (Smartwatch): (3 << 6) | 2.
    expect(appearanceName(194)).toBe('Watch / Smartwatch');
  });

  it('falls back to the category for unregistered subcategories', () => {
    expect(appearanceName((3 << 6) | 0x3f)).toBe('Watch');
  });

  it('treats 0 ("Unknown") and undefined as no information', () => {
    expect(appearanceName(0)).toBeUndefined();
    expect(appearanceName(undefined)).toBeUndefined();
  });
});
