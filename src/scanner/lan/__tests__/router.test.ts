import { OUI_VENDORS } from '@/scanner/lan/ouiVendors.generated';
import { buildRouterSighting } from '@/scanner/lan/router';

const [oui, vendor] = Object.entries(OUI_VENDORS)[0];
const bssid = `${oui.slice(0, 2)}:${oui.slice(2, 4)}:${oui.slice(4, 6)}:00:11:22`;

describe('buildRouterSighting', () => {
  it('reports the gateway with the BSSID vendor', () => {
    const sighting = buildRouterSighting({
      bssid,
      ipAddress: '192.168.1.57',
      subnet: '255.255.255.0',
    });
    expect(sighting).toEqual({
      id: 'lan:192.168.1.1',
      transport: 'lan',
      signals: { ip: '192.168.1.1', mac: bssid, apVendor: vendor },
    });
  });

  it('skips when the BSSID vendor is unknown (avoids inventing a ghost device)', () => {
    expect(
      buildRouterSighting({
        bssid: '02:00:00:00:00:00',
        ipAddress: '192.168.1.57',
        subnet: '255.255.255.0',
      })
    ).toBeUndefined();
  });

  it('skips when Wi-Fi details are incomplete', () => {
    expect(buildRouterSighting(null)).toBeUndefined();
    expect(
      buildRouterSighting({ bssid, ipAddress: null, subnet: '255.255.255.0' })
    ).toBeUndefined();
    expect(buildRouterSighting({ bssid, ipAddress: '192.168.1.57', subnet: null })).toBeUndefined();
  });
});
