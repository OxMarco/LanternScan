import { appleModelName } from '@/scanner/fingerprint/appleModels';
import { guessDevice } from '@/scanner/fingerprint/guess';

describe('appleModelName', () => {
  it('maps exact iPhone identifiers to marketing names', () => {
    expect(appleModelName('iPhone15,4')).toBe('iPhone 15');
    expect(appleModelName('iPhone10,4')).toBe('iPhone 8');
    expect(appleModelName('  iPhone10,4\n')).toBe('iPhone 8');
  });

  it('falls back to family prefixes', () => {
    expect(appleModelName('MacBookPro18,3')).toBe('MacBook Pro');
    expect(appleModelName('iPad13,1')).toBe('iPad');
  });

  it('returns undefined for unknown identifiers', () => {
    expect(appleModelName('Nexus5')).toBeUndefined();
  });
});

describe('guessDevice', () => {
  it('ranks a GATT-read manufacturer + model above every advertised guess', () => {
    const [top] = guessDevice({
      manufacturerCompanyId: 0x004c, // Apple, weak advertised signal
      gatt: { manufacturer: 'Garmin', modelNumber: 'Forerunner 265' },
    });
    expect(top.label).toBe('Garmin Forerunner 265');
    expect(top.confidence).toBeGreaterThan(0.9);
  });

  it('resolves an Apple hardware identifier read over GATT', () => {
    const [top] = guessDevice({
      gatt: { manufacturer: 'Apple Inc.', modelNumber: 'iPhone10,4' },
    });
    expect(top).toMatchObject({
      label: 'Apple iPhone 8',
      vendor: 'Apple',
      family: 'iPhone',
      type: 'phone',
    });
    expect(top.confidence).toBe(0.98);
  });

  it('keeps future Apple identifiers recognizable through family fallbacks', () => {
    const [top] = guessDevice({
      gatt: { manufacturer: 'Apple Inc.', modelNumber: 'iPhone99,1' },
    });
    expect(top).toMatchObject({ label: 'Apple iPhone', type: 'phone' });
  });

  it('labels a router from its Wi-Fi access-point vendor', () => {
    const guesses = guessDevice({ ip: '192.168.1.1', apVendor: 'Netgear' });
    expect(guesses.some((guess) => guess.label === 'Netgear router')).toBe(true);
  });

  it('ranks the self-reported UPnP identity highest', () => {
    const guesses = guessDevice({
      ssdp: { manufacturer: 'Sonos', modelName: 'One' },
      openPorts: [80],
    });
    expect(guesses[0].label).toBe('Sonos One');
    expect(guesses[0].confidence).toBeGreaterThan(0.8);
  });

  it('resolves an Apple model from the Bonjour device-info record', () => {
    const [top] = guessDevice({ mdnsTxt: { model: 'MacBookPro18,3' } });
    expect(top.label).toBe('Apple MacBook Pro (14-Inch, M1, 2021)');
    expect(top.type).toBe('computer');
    expect(top.categoryConfidence).toBeGreaterThan(0.8);
    expect(top.modelConfidence).toBeGreaterThan(0.8);
  });

  it('reads the exact printer identity from IPP TXT records', () => {
    const [top] = guessDevice({
      mdnsServices: ['_ipp._tcp'],
      mdnsTxt: { ty: 'HP ENVY 6000 series', usb_MFG: 'HP', usb_MDL: 'ENVY 6000 series' },
    });
    expect(top.label).toBe('HP ENVY 6000 series');
    expect(top.reason).toContain('IPP');
  });

  it('names a Matter accessory from its commissioning TXT record', () => {
    const guesses = guessDevice({
      mdnsServices: ['_matterc._udp'],
      mdnsTxt: { VP: '65521+32769', DN: 'Kitchen Plug' },
    });
    expect(guesses[0].label).toBe('Kitchen Plug (Matter accessory)');
  });

  it('names a Thread border router from its MeshCoP TXT record', () => {
    const guesses = guessDevice({
      mdnsServices: ['_meshcop._udp'],
      mdnsTxt: { vn: 'Apple', mn: 'HomePod' },
    });
    expect(guesses.some((guess) => guess.label === 'Apple HomePod (Thread border router)')).toBe(
      true
    );
  });

  it('turns an Apple Continuity beacon into a typed guess', () => {
    const guesses = guessDevice({
      manufacturerCompanyId: 0x004c,
      manufacturerData: Buffer.from([
        0x4c, 0x00, 0x07, 0x0a, 0x01, 0x0e, 0x20, 0x55, 0xaa, 0x56, 0x31, 0x00, 0x00, 0x6f,
      ]).toString('base64'),
    });
    expect(guesses[0].label).toBe('Apple AirPods Pro');
    expect(guesses[0].type).toBe('speaker');
  });

  it('reinforces confidence when independent signals agree', () => {
    const single = guessDevice({ mdnsServices: ['_ipp._tcp'] })[0];
    const combined = guessDevice({ mdnsServices: ['_ipp._tcp'], openPorts: [9100] })[0];
    expect(combined.label).toBe('Printer');
    expect(combined.confidence).toBeGreaterThan(single.confidence);
  });

  it('does not count correlated decoders from one source as independent', () => {
    const [printer] = guessDevice({
      mdnsServices: ['_ipp._tcp', '_ipps._tcp', '_printer._tcp'],
    });
    expect(printer.label).toBe('Printer');
    expect(printer.confidence).toBe(0.8);
    expect(printer.evidenceSources).toEqual(['mdns']);
  });

  it('tracks category and exact-model certainty independently', () => {
    const [printer] = guessDevice({
      mdnsServices: ['_ipp._tcp'],
      mdnsTxt: { ty: 'HP ENVY 6000 series' },
      openPorts: [9100],
    });
    expect(printer.label).toBe('HP ENVY 6000 series');
    expect(printer.modelConfidence).toBe(0.9);
    expect(printer.categoryConfidence).toBeGreaterThan(printer.modelConfidence ?? 1);
  });

  it('discounts a weak contradictory name instead of overriding ground truth', () => {
    const guesses = guessDevice({
      name: 'GalaxyPhone',
      gatt: { manufacturer: 'Garmin', modelNumber: 'Forerunner 265' },
    });
    expect(guesses[0]).toMatchObject({ label: 'Garmin Forerunner 265', type: 'wearable' });
    expect(guesses[0].categoryConfidence).toBeGreaterThan(0.9);
    const phone = guesses.find((guess) => guess.type === 'phone');
    expect(phone?.categoryConfidence).toBeLessThan(0.6);
  });

  it('returns at most three guesses', () => {
    const guesses = guessDevice({
      name: 'iPhone',
      mdnsServices: ['_airplay._tcp', '_companion-link._tcp'],
      openPorts: [62078, 80, 443],
    });
    expect(guesses.length).toBeLessThanOrEqual(3);
  });

  it('produces nothing when there are no signals', () => {
    expect(guessDevice({})).toEqual([]);
  });

  it('places a locally corrected label first and exposes structured identity', () => {
    const [top] = guessDevice({
      userLabel: 'Samsung Galaxy S24 phone',
      manufacturerCompanyId: 0x0075,
    });
    expect(top).toMatchObject({
      label: 'Samsung Galaxy S24 phone',
      vendor: 'Samsung',
      family: 'Galaxy',
      type: 'phone',
    });
    expect(top.confidence).toBeGreaterThan(0.99);
  });

  it('infers a device type from an advertised BLE service UUID', () => {
    const [top] = guessDevice({
      serviceUUIDs: ['0000180d-0000-1000-8000-00805f9b34fb'],
    });
    expect(top.label).toMatch(/fitness/i);
    expect(top.reason).toContain('Heart Rate');
  });

  it('folds a Fingerbank match in as reinforcing evidence', () => {
    const withFingerbank = guessDevice({
      mdnsServices: ['_airplay._tcp'],
      fingerbank: {
        label: 'AirPlay device (Apple TV / smart TV)',
        confidence: 0.8,
        reason: 'Fingerbank match',
      },
    })[0];
    const offlineOnly = guessDevice({ mdnsServices: ['_airplay._tcp'] })[0];
    expect(withFingerbank.label).toBe(offlineOnly.label);
    expect(withFingerbank.confidence).toBeGreaterThan(offlineOnly.confidence);
  });

  it('identifies a Windows PC from its Microsoft CDP beacon', () => {
    const [top] = guessDevice({
      manufacturerCompanyId: 0x0006,
      manufacturerData: Buffer.from([0x06, 0x00, 0x01, 0x2f, 0x21, 0x0a]).toString('base64'),
    });
    expect(top.label).toBe('Windows laptop');
    expect(top.reason).toContain('Microsoft CDP');
  });

  it('identifies a tracker from its offline-finding frame', () => {
    const [top] = guessDevice({
      manufacturerCompanyId: 0x004c,
      manufacturerData: Buffer.from([0x4c, 0x00, 0x12, 0x19, 0x10, 0x00]).toString('base64'),
    });
    expect(top.label).toBe('Apple AirTag');
  });

  it('resolves a Fast Pair model ID to a product name', () => {
    const [top] = guessDevice({
      serviceData: { fe2c: Buffer.from([0x00, 0x00, 0xf0]).toString('base64') },
    });
    expect(top.label).toMatch(/Bose/);
  });

  it('identifies a Tile via the Sniffypedia service UUID index', () => {
    const [top] = guessDevice({ serviceUUIDs: ['0000feed-0000-1000-8000-00805f9b34fb'] });
    expect(top.label).toBe('Tile');
  });

  it('uses the advertised GAP appearance as evidence', () => {
    const [top] = guessDevice({ appearance: 194 });
    expect(top.label).toBe('Watch / Smartwatch');
  });

  it('matches Home Assistant discovery rules on mDNS TXT properties', () => {
    const guesses = guessDevice({
      mdnsServices: ['_airplay._tcp'],
      mdnsTxt: { model: 'AppleTV6,2' },
    });
    expect(guesses.map((guess) => guess.label)).toContain('Apple TV');
  });

  it('identifies hardware from the Server header via recog', () => {
    const guesses = guessDevice({ httpServer: 'Synology/DSM/7.1.1-42962' });
    // recog's server fingerprints name the vendor even without a description XML.
    expect(guesses.map((guess) => guess.label).join(' ')).toMatch(/Synology/);
  });

  it('identifies a device from its admin-page favicon hash', () => {
    const [top] = guessDevice({ faviconMd5: 'd2cef6047a604012455f5c9a1cd4d960' });
    expect(top.label).toMatch(/Jellyfin/);
  });

  it.each([
    ['living-room-chromecast', 'Chromecast'],
    ['Marco’s PS5', 'PlayStation 5'],
    ['raspberrypi.local', 'Raspberry Pi'],
    ['HP-LaserJet-M404', 'HP printer'],
    ['Front Door Ring Doorbell', 'Ring camera / doorbell'],
  ])('recognizes %s from a normalized device name', (name, expected) => {
    expect(guessDevice({ name })[0]?.label).toBe(expected);
  });

  it('uses the name read over GATT when the advertisement name is absent', () => {
    const [top] = guessDevice({ gatt: { name: 'Bedroom HomePod' } });
    expect(top.label).toBe('HomePod');
    expect(top.reason).toContain('Bedroom HomePod');
  });

  it('recognizes a standard UPnP device type without a model name', () => {
    const [top] = guessDevice({
      ssdp: { deviceType: 'urn:schemas-upnp-org:device:InternetGatewayDevice:1' },
    });
    expect(top).toMatchObject({ label: 'Router / gateway', type: 'router' });
    expect(top.reason).toContain('UPnP device type');
  });

  it('does not match product words embedded inside unrelated names', () => {
    expect(guessDevice({ name: 'pixelated-art.local' })).toEqual([]);
    expect(guessDevice({ name: 'canonical-build-server' })).toEqual([]);
  });
});
