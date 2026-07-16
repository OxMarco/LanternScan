import {
  decodeOnlineIdentification,
  DEFAULT_ONLINE_IDENTIFICATION,
  isSpecificOfflineIdentity,
} from '@/scanner/fingerprint/onlineIdentification';

describe('online identification preference', () => {
  it.each(['enabled', 'disabled'] as const)('accepts %s', (value) => {
    expect(decodeOnlineIdentification(value)).toBe(value);
  });

  it('keeps online identification off until the user opts in', () => {
    expect(DEFAULT_ONLINE_IDENTIFICATION).toBe('disabled');
    expect(decodeOnlineIdentification(null)).toBe('disabled');
    expect(decodeOnlineIdentification('unexpected')).toBe('disabled');
  });
});

describe('online enrichment specificity', () => {
  it('does not treat a confident generic category as a complete identity', () => {
    expect(
      isSpecificOfflineIdentity({
        label: 'Printer',
        confidence: 0.9,
        categoryConfidence: 0.95,
        type: 'printer',
        reason: 'Advertises _ipp._tcp',
      })
    ).toBe(false);
  });

  it('accepts a supported model or family as sufficiently specific', () => {
    expect(
      isSpecificOfflineIdentity({
        label: 'Apple iPhone 8',
        confidence: 0.9,
        family: 'iPhone',
        model: 'iPhone 8',
        familyConfidence: 0.9,
        modelConfidence: 0.9,
        reason: 'Read from the device information service',
      })
    ).toBe(true);
  });

  it('always respects an identity supplied by the user', () => {
    expect(
      isSpecificOfflineIdentity({
        label: 'Kitchen thing',
        confidence: 1,
        reason: 'Identified by you',
      })
    ).toBe(true);
  });
});
