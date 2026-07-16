import { CATEGORY_ICON, presentDevice, TRUST_LABEL } from '@/scanner/present';
import type { Device } from '@/scanner/types';

const device: Device = {
  id: 'ble:test',
  transport: 'ble',
  signals: { name: 'Desk speaker', rssi: -58 },
  distanceMeters: 1.4,
  firstSeenAt: 100,
  lastSeenAt: 200,
};

describe('device presentation', () => {
  it('exposes readable signal and activity metadata for list rows', () => {
    const presentation = presentDevice(device, { whitelist: [], blacklist: [] }, true);

    expect(presentation.lastSeenAt).toBe(200);
    expect(presentation.signalLabel).toBe('-58 dBm');
    expect(presentation.distanceLabel).toBe('~1.4 m');
  });

  it('uses clear review terminology without changing stored trust values', () => {
    expect(TRUST_LABEL.whitelisted).toBe('Familiar');
    expect(TRUST_LABEL.blacklisted).toBe('Investigate');
  });

  it('derives the category from the structured guess type, not just keywords', () => {
    // Port 9100 yields a "Printer" guess whose structured type must reach the UI
    // category instead of falling through to "unknown".
    const printer = presentDevice(
      {
        id: 'lan:192.168.1.55',
        transport: 'lan',
        signals: { ip: '192.168.1.55', openPorts: [9100] },
        firstSeenAt: 100,
        lastSeenAt: 200,
      },
      { whitelist: [], blacklist: [] },
      false
    );
    expect(printer.category).toBe('printer');
  });

  it('renders a GATT-identified iPhone with the smartphone category and icon', () => {
    const iphone = presentDevice(
      {
        id: 'ble:iphone',
        transport: 'ble',
        signals: { gatt: { manufacturer: 'Apple Inc.', modelNumber: 'iPhone10,4' } },
        firstSeenAt: 100,
        lastSeenAt: 200,
      },
      { whitelist: [], blacklist: [] },
      false
    );

    expect(iphone.title).toBe('Apple iPhone 8');
    expect(iphone.category).toBe('phone');
    expect(CATEGORY_ICON[iphone.category]).toBe('smartphone');
  });

  it.each([
    ['iPhone99,42', 'phone', 'smartphone'],
    ['Mac99,42', 'computer', 'monitor'],
    ['iMac99,42', 'computer', 'monitor'],
    ['MacBookPro99,42', 'computer', 'monitor'],
  ] as const)('classifies the %s family without knowing its version', (name, category, icon) => {
    const presentation = presentDevice(
      {
        id: `ble:${name}`,
        transport: 'ble',
        signals: { name },
        firstSeenAt: 100,
        lastSeenAt: 200,
      },
      { whitelist: [], blacklist: [] },
      false
    );

    expect(presentation.category).toBe(category);
    expect(CATEGORY_ICON[presentation.category]).toBe(icon);
  });

  it.each([
    ['SamsungTV2026', 'tv', 'tv'],
    ['AirConditioner9000', 'appliance', 'wind'],
    ['OuraRing4', 'ring', 'circle'],
    ['GalaxyRing2', 'ring', 'circle'],
    ['RingDoorbell2', 'camera', 'video'],
    ['AppleWatch10,1', 'wearable', 'watch'],
    ['GalaxyWatch7', 'wearable', 'watch'],
    ['AirPodsPro3', 'speaker', 'speaker'],
    ['AirTag2,1', 'tracker', 'map-pin'],
    ['LaserJet500', 'printer', 'printer'],
    ['FritzBox9000', 'router', 'wifi'],
    ['TemperatureSensor2', 'sensor', 'activity'],
    ['HueBulb4', 'light', 'sun'],
    ['NestThermostat3', 'thermostat', 'thermometer'],
    ['SynologyNAS2', 'nas', 'hard-drive'],
    ['PlayStation6', 'console', 'play'],
    ['MagicKeyboard2', 'peripheral', 'type'],
    ['RoombaVacuum9', 'appliance', 'wind'],
  ] as const)('classifies versioned %s as %s', (name, category, icon) => {
    const presentation = presentDevice(
      {
        id: `ble:${name}`,
        transport: 'ble',
        signals: { name },
        firstSeenAt: 100,
        lastSeenAt: 200,
      },
      { whitelist: [], blacklist: [] },
      false
    );

    expect(presentation.category).toBe(category);
    expect(CATEGORY_ICON[presentation.category]).toBe(icon);
  });

  it('classifies manufacturer-only sightings by what the vendor makes', () => {
    // A bare SIG company ID yields "<Company> device"; the company name alone
    // (industry words or a single-vertical brand) should still pick the icon.
    const categoryFor = (manufacturerCompanyId: number) =>
      presentDevice(
        {
          id: `ble:company-${manufacturerCompanyId}`,
          transport: 'ble',
          signals: { manufacturerCompanyId },
          firstSeenAt: 100,
          lastSeenAt: 200,
        },
        { whitelist: [], blacklist: [] },
        false
      ).category;

    expect(categoryFor(1704)).toBe('appliance'); // GD Midea Air-Conditioning Equipment
    expect(categoryFor(690)).toBe('ring'); // Oura Health Oy
    expect(categoryFor(137)).toBe('speaker'); // GN Hearing A/S
    expect(categoryFor(1447)).toBe('speaker'); // Sonos Inc
    expect(categoryFor(1660)).toBe('tracker'); // Tile, Inc.
    expect(categoryFor(1551)).toBe('light'); // Signify (Philips Lighting)
    // Loose substring matches: "fit" anywhere means fitness gear…
    expect(categoryFor(223)).toBe('wearable'); // Misfit Wearables Corp
    expect(categoryFor(508)).toBe('wearable'); // Wahoo Fitness, LLC
    // …but corpus-proven collisions keep their word boundaries.
    expect(categoryFor(1281)).toBe('unknown'); // Polaris IND is not Polar
    expect(categoryFor(3408)).toBe('unknown'); // FOTILE Kitchenware is not Tile
    expect(categoryFor(1577)).toBe('unknown'); // PHONEPE is not a phone
    expect(categoryFor(3203)).toBe('unknown'); // Watchdog Systems is not a watch
    expect(categoryFor(3319)).toBe('unknown'); // TVS Motor is not a TV
    expect(categoryFor(3895)).toBe('unknown'); // Schueco is not Hue
  });

  it('does not substring-match category keywords inside longer words', () => {
    const engineering = presentDevice(
      {
        id: 'lan:192.168.1.77',
        transport: 'lan',
        signals: { ip: '192.168.1.77', hostname: 'engineering-laptop.local' },
        firstSeenAt: 100,
        lastSeenAt: 200,
      },
      { whitelist: [], blacklist: [] },
      false
    );
    // "engineering" must not hit the 'ring' keyword before 'laptop' resolves.
    expect(engineering.category).toBe('computer');
  });

  it('categorizes named devices the guess engine cannot type', () => {
    const soundbar = presentDevice(
      {
        id: 'ble:soundbar',
        transport: 'ble',
        signals: { name: 'TCL S55H Soundbar' },
        firstSeenAt: 100,
        lastSeenAt: 200,
      },
      { whitelist: [], blacklist: [] },
      false
    );
    expect(soundbar.category).toBe('speaker');
  });
});
