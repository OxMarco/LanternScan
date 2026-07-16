import { resolveTrust, setTrust, trustListsSetting } from '@/scanner/trustStore';

describe('resolveTrust', () => {
  const lists = { whitelist: ['lan:a'], blacklist: ['lan:b'] };

  it('prioritises blacklist over everything', () => {
    expect(resolveTrust('lan:b', { whitelist: ['lan:b'], blacklist: ['lan:b'] }, false)).toBe(
      'blacklisted'
    );
  });

  it('reports whitelisted and known devices', () => {
    expect(resolveTrust('lan:a', lists, true)).toBe('whitelisted');
    expect(resolveTrust('lan:c', lists, false)).toBe('known');
  });

  it('marks unseen devices as new', () => {
    expect(resolveTrust('lan:c', lists, true)).toBe('new');
  });
});

describe('setTrust', () => {
  beforeEach(async () => {
    await trustListsSetting.set({ whitelist: [], blacklist: [] });
  });

  it('moves a device between lists and clears it', async () => {
    await setTrust('lan:x', 'whitelisted');
    expect((await trustListsSetting.read()).whitelist).toContain('lan:x');

    await setTrust('lan:x', 'blacklisted');
    const afterBlacklist = await trustListsSetting.read();
    expect(afterBlacklist.whitelist).not.toContain('lan:x');
    expect(afterBlacklist.blacklist).toContain('lan:x');

    await setTrust('lan:x', 'none');
    const cleared = await trustListsSetting.read();
    expect(cleared.whitelist).not.toContain('lan:x');
    expect(cleared.blacklist).not.toContain('lan:x');
  });
});
