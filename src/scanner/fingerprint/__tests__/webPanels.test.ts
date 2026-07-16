import { identifyWebPanel } from '@/scanner/fingerprint/webPanels';

describe('identifyWebPanel', () => {
  it('identifies common local appliance panels', () => {
    expect(identifyWebPanel('<title>Synology DiskStation</title>')).toBe('Synology DiskStation');
    expect(identifyWebPanel('<title>LuCI - OpenWrt Configuration Interface</title>')).toBe(
      'OpenWrt router'
    );
  });

  it('does not classify an ordinary web page', () => {
    expect(identifyWebPanel('<title>My website</title>')).toBeUndefined();
  });
});
