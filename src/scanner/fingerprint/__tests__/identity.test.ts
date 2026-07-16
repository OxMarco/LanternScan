import { canonicalIdentityKey, structuredIdentity } from '@/scanner/fingerprint/identity';

describe('identity normalization', () => {
  it('maps equivalent product labels to one scoring key', () => {
    expect(canonicalIdentityKey('Chromecast')).toBe(
      canonicalIdentityKey('Google Cast device (Chromecast / smart speaker)')
    );
  });

  it('extracts structured fields while retaining the display label', () => {
    expect(structuredIdentity('Samsung Galaxy S24 phone')).toEqual({
      vendor: 'Samsung',
      family: 'Galaxy',
      model: 'Galaxy S24 phone',
      type: 'phone',
    });
  });
});
