import { createDeviceRegistry, STALE_DEVICE_MS } from '@/scanner/registry';

describe('createDeviceRegistry', () => {
  it('merges sightings and unions array signals', () => {
    const registry = createDeviceRegistry();
    registry.report({
      id: 'lan:1',
      transport: 'lan',
      signals: { ip: '10.0.0.1', openPorts: [80] },
    });
    registry.report({
      id: 'lan:1',
      transport: 'lan',
      signals: { hostname: 'nas.local', openPorts: [445] },
    });

    const [device] = registry.getDevices();
    expect(device.signals.ip).toBe('10.0.0.1');
    expect(device.signals.hostname).toBe('nas.local');
    expect(device.signals.openPorts).toEqual([80, 445]);
  });

  it('starts each scan with fresh volatile signals', () => {
    const registry = createDeviceRegistry();
    registry.beginScan('lan');
    registry.report({
      id: 'lan:1',
      transport: 'lan',
      signals: { ip: '10.0.0.1', mdnsServices: ['_airplay._tcp'], openPorts: [80] },
    });
    registry.beginScan('lan');
    registry.report({
      id: 'lan:1',
      transport: 'lan',
      signals: { ip: '10.0.0.1', openPorts: [9100] },
    });

    expect(registry.getDevices()[0].signals.mdnsServices).toBeUndefined();
    expect(registry.getDevices()[0].signals.openPorts).toEqual([9100]);
  });

  it('marks a different host reusing the same LAN IP as new', async () => {
    const registry = createDeviceRegistry();
    await registry.hydrate();
    registry.beginScan('lan');
    registry.report({
      id: 'lan:10.0.0.8',
      transport: 'lan',
      signals: { ip: '10.0.0.8', hostname: 'old-speaker.local' },
    });
    registry.beginScan('lan');
    registry.report({
      id: 'lan:10.0.0.8',
      transport: 'lan',
      signals: { ip: '10.0.0.8', hostname: 'new-printer.local' },
    });

    expect(registry.isNew('lan:10.0.0.8')).toBe(true);
    expect(registry.getDevices()[0].signals.hostname).toBe('new-printer.local');
  });

  it('expires devices that have not been seen recently', () => {
    const registry = createDeviceRegistry();
    registry.report({ id: 'ble:stale', transport: 'ble', signals: { name: 'Old sensor' } });
    const lastSeenAt = registry.getDevices()[0].lastSeenAt;
    registry.expireStale(lastSeenAt + STALE_DEVICE_MS + 1);
    expect(registry.getDevices()).toHaveLength(0);
  });

  it('derives distance from BLE RSSI', () => {
    const registry = createDeviceRegistry();
    registry.report({ id: 'ble:1', transport: 'ble', signals: { rssi: -59, txPower: -59 } });
    const [device] = registry.getDevices();
    expect(device.distanceMeters).toBeGreaterThan(0);
  });

  it('annotates a known device with a Fingerbank guess via enrich', () => {
    const registry = createDeviceRegistry();
    registry.report({ id: 'lan:9', transport: 'lan', signals: { ip: '10.0.0.9' } });
    registry.enrich('lan:9', { label: 'Apple TV', confidence: 0.8, reason: 'Fingerbank match' });
    const [device] = registry.getDevices();
    expect(device.signals.fingerbank?.label).toBe('Apple TV');
  });

  it('does not resurrect an unknown device on enrich', () => {
    const registry = createDeviceRegistry();
    registry.enrich('lan:missing', { label: 'Nope', confidence: 0.5, reason: 'Fingerbank match' });
    expect(registry.getDevices()).toHaveLength(0);
  });

  it('notifies subscribers on report', () => {
    const registry = createDeviceRegistry();
    const listener = jest.fn();
    registry.subscribe(listener);
    registry.report({ id: 'lan:2', transport: 'lan', signals: { ip: '10.0.0.2' } });
    expect(listener).toHaveBeenCalled();
  });

  it('treats devices unknown at hydrate time as new', async () => {
    const registry = createDeviceRegistry();
    await registry.hydrate();
    registry.report({ id: 'lan:fresh', transport: 'lan', signals: { ip: '10.0.0.9' } });
    expect(registry.isNew('lan:fresh')).toBe(true);
  });

  it('forgets devices on demand', () => {
    const registry = createDeviceRegistry();
    registry.report({ id: 'lan:3', transport: 'lan', signals: { ip: '10.0.0.3' } });
    registry.forget('lan:3');
    expect(registry.getDevices()).toHaveLength(0);
  });
});
