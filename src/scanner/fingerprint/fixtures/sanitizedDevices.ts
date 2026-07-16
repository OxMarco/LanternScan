import type { DeviceSignals, DeviceType, Transport } from '@/scanner/types';

export type DetectionFixture = {
  id: string;
  transport: Transport;
  signals: DeviceSignals;
  expected: {
    category: DeviceType;
    label?: string;
    family?: string;
    model?: string;
  };
};

// Sanitized captures representing the protocol combinations seen in real
// consumer devices. Addresses, serials, household names, and unique beacon
// payloads are deliberately absent. Keep this corpus when fixing a field report:
// add the minimal non-identifying signals and the independently verified truth.
export const SANITIZED_DEVICE_FIXTURES: DetectionFixture[] = [
  {
    id: 'apple-iphone-8',
    transport: 'ble',
    signals: { gatt: { manufacturer: 'Apple Inc.', modelNumber: 'iPhone10,4' } },
    expected: {
      category: 'phone',
      label: 'Apple iPhone 8',
      family: 'iPhone',
      model: 'iPhone 8',
    },
  },
  {
    id: 'apple-macbook-pro',
    transport: 'lan',
    signals: { mdnsTxt: { model: 'MacBookPro18,3' } },
    expected: { category: 'computer', family: 'MacBook' },
  },
  {
    id: 'sonos-one',
    transport: 'lan',
    signals: {
      mdnsServices: ['_sonos._tcp'],
      ssdp: { manufacturer: 'Sonos', modelName: 'One', deviceType: 'MediaRenderer' },
    },
    expected: { category: 'speaker', label: 'Sonos One', model: 'One' },
  },
  {
    id: 'hp-envy-printer',
    transport: 'lan',
    signals: {
      mdnsServices: ['_ipp._tcp'],
      mdnsTxt: { ty: 'HP ENVY 6000 series', usb_MFG: 'HP', usb_MDL: 'ENVY 6000 series' },
      openPorts: [9100],
    },
    expected: { category: 'printer', label: 'HP ENVY 6000 series' },
  },
  {
    id: 'android-tv',
    transport: 'lan',
    signals: { name: 'LivingRoomTV2026', mdnsServices: ['_androidtvremote2._tcp'] },
    expected: { category: 'tv' },
  },
  {
    id: 'air-conditioner',
    transport: 'ble',
    signals: { name: 'AirConditioner9000' },
    expected: { category: 'appliance', label: 'Air conditioner' },
  },
  {
    id: 'galaxy-ring',
    transport: 'ble',
    signals: { name: 'GalaxyRing2' },
    expected: { category: 'ring', label: 'Samsung Galaxy Ring', family: 'Galaxy' },
  },
  {
    id: 'ring-doorbell',
    transport: 'lan',
    signals: { hostname: 'RingDoorbell2.local' },
    expected: { category: 'camera', label: 'Ring camera / doorbell', family: 'Ring' },
  },
  {
    id: 'apple-watch',
    transport: 'ble',
    signals: { name: 'AppleWatch10,1' },
    expected: { category: 'wearable', label: 'Apple Watch', family: 'Apple Watch' },
  },
  {
    id: 'synology-nas',
    transport: 'lan',
    signals: { httpServer: 'Synology/DSM/7.1.1-42962', openPorts: [445] },
    expected: { category: 'nas' },
  },
  {
    id: 'hue-bridge',
    transport: 'lan',
    signals: { mdnsServices: ['_hue._tcp'], mdnsTxt: { md: 'BSB002' } },
    expected: { category: 'light', label: 'Philips Hue bridge' },
  },
  {
    id: 'netgear-router',
    transport: 'lan',
    signals: { apVendor: 'Netgear' },
    expected: { category: 'router', label: 'Netgear router' },
  },
];
