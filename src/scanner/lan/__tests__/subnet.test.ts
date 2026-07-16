import { enumerateHosts, gatewayAddress } from '@/scanner/lan/subnet';

describe('gatewayAddress', () => {
  it('returns the first usable host of the subnet', () => {
    expect(gatewayAddress('192.168.1.57', '255.255.255.0')).toBe('192.168.1.1');
    expect(gatewayAddress('10.0.5.9', '255.255.0.0')).toBe('10.0.0.1');
  });

  it('returns undefined for malformed input', () => {
    expect(gatewayAddress('not-an-ip', '255.255.255.0')).toBeUndefined();
  });
});

describe('enumerateHosts', () => {
  it('lists usable hosts on a /24 excluding network, broadcast, and self', () => {
    const hosts = enumerateHosts('192.168.1.20', '255.255.255.0');
    expect(hosts).toHaveLength(253); // 254 usable minus own address
    expect(hosts).toContain('192.168.1.1');
    expect(hosts).toContain('192.168.1.254');
    expect(hosts).not.toContain('192.168.1.0');
    expect(hosts).not.toContain('192.168.1.255');
    expect(hosts).not.toContain('192.168.1.20');
  });

  it('caps the host count for wide masks', () => {
    const hosts = enumerateHosts('10.0.0.5', '255.255.0.0', 100);
    expect(hosts).toHaveLength(100);
  });

  it('returns nothing for malformed input', () => {
    expect(enumerateHosts('not-an-ip', '255.255.255.0')).toEqual([]);
    expect(enumerateHosts('192.168.1.1', '999.0.0.0')).toEqual([]);
  });
});
