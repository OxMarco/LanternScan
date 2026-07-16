import { deviceRegistry } from '@/scanner/registry';
import { trustListsSetting } from '@/scanner/trustStore';
import type { DeviceSighting } from '@/scanner/types';

// A curated, fictional scene used only in demo builds (see @/lib/demoMode).
// Names are chosen so the normal fingerprint/category pipeline resolves each to
// the right icon and title with no special-casing — these flow through
// deviceRegistry.report() exactly like real sightings.

// BLE peripherals are placed on the radial field purely by RSSI: the estimator
// (measured power -59 dBm, path-loss 2.2) maps these values across the three
// honesty zones — "Right here" (<2 m), "Same room" (2-6 m), "Farther away".
const BLE_DEVICES: DeviceSighting[] = [
  { id: 'ble:1F2E3D4C-5B6A-7980-A1B2-C3D4E5F60718', transport: 'ble', signals: { name: 'Apple Watch', rssi: -48 } }, // ~0.3 m
  { id: 'ble:2A3B4C5D-6E7F-8091-A2B3-C4D5E6F70819', transport: 'ble', signals: { name: 'AirPods Pro', rssi: -58 } }, // ~0.9 m
  { id: 'ble:3B4C5D6E-7F80-91A2-B3C4-D5E6F708192A', transport: 'ble', signals: { name: "Kevin's iPhone", rssi: -63 } }, // ~1.5 m
  { id: 'ble:4C5D6E7F-8091-A2B3-C4D5-E6F708192A3B', transport: 'ble', signals: { name: 'Logitech MX Keyboard', rssi: -66 } }, // ~2.1 m
  { id: 'ble:5D6E7F80-91A2-B3C4-D5E6-F708192A3B4C', transport: 'ble', signals: { name: 'Oura Ring', rssi: -70 } }, // ~3.2 m
  { id: 'ble:6E7F8091-A2B3-C4D5-E6F7-08192A3B4C5D', transport: 'ble', signals: { name: 'Beats Studio Buds', rssi: -74 } }, // ~4.9 m
  { id: 'ble:7F8091A2-B3C4-D5E6-F708-192A3B4C5D6E', transport: 'ble', signals: { name: 'Galaxy SmartTag', rssi: -78 } }, // ~7.3 m
  { id: 'ble:8091A2B3-C4D5-E6F7-0819-2A3B4C5D6E7F', transport: 'ble', signals: { name: 'Mi Band 8', rssi: -82 } }, // ~11 m
];

// LAN hosts render in the sonar + list view, grouped by trust and sorted by IP.
// Each carries an IP and MAC so the subtitle reads like a real scan result.
const LAN_DEVICES: DeviceSighting[] = [
  { id: 'lan:192.168.1.1', transport: 'lan', signals: { name: 'FRITZ!Box 7590', ip: '192.168.1.1', mac: '3C:A6:2F:11:04:8A' } },
  { id: 'lan:192.168.1.9', transport: 'lan', signals: { name: 'Synology DS220+', ip: '192.168.1.9', mac: '00:11:32:6E:1C:D0' } },
  { id: 'lan:192.168.1.15', transport: 'lan', signals: { name: 'Philips Hue Bridge', ip: '192.168.1.15', mac: 'EC:B5:FA:2D:87:41' } },
  { id: 'lan:192.168.1.24', transport: 'lan', signals: { name: 'MacBook Pro', hostname: 'Kevins-MacBook-Pro.local', ip: '192.168.1.24', mac: 'A4:83:E7:9B:22:F5' } },
  { id: 'lan:192.168.1.31', transport: 'lan', signals: { name: 'HomePod mini', ip: '192.168.1.31', mac: 'D0:03:4B:55:8E:12' } },
  { id: 'lan:192.168.1.42', transport: 'lan', signals: { name: 'Apple TV 4K', ip: '192.168.1.42', mac: '7C:D1:C3:44:A9:6B' } },
  { id: 'lan:192.168.1.50', transport: 'lan', signals: { name: 'Chromecast', ip: '192.168.1.50', mac: '54:60:09:F2:3E:77' } },
  { id: 'lan:192.168.1.55', transport: 'lan', signals: { name: 'Sonos One', ip: '192.168.1.55', mac: '48:A6:B8:0C:71:9D' } },
  { id: 'lan:192.168.1.66', transport: 'lan', signals: { name: 'HP OfficeJet Pro', ip: '192.168.1.66', mac: '3C:52:82:1A:B4:E0' } },
  { id: 'lan:192.168.1.71', transport: 'lan', signals: { name: 'Nest Thermostat', ip: '192.168.1.71', mac: '18:B4:30:5F:C2:39' } },
  { id: 'lan:192.168.1.88', transport: 'lan', signals: { name: 'Ring Doorbell', ip: '192.168.1.88', mac: '00:62:6E:44:1D:AC' } },
];

// A couple of hosts are marked "Familiar" (green) so the trust triage — the
// point of the app — is visible in a screenshot instead of a wall of "New".
const WHITELISTED_IDS = ['lan:192.168.1.24', 'lan:192.168.1.31', 'ble:2A3B4C5D-6E7F-8091-A2B3-C4D5E6F70819'];

/**
 * Populate the device registry with the demo scene. Safe to call repeatedly —
 * report() refreshes lastSeenAt, keeping devices from expiring during a long
 * screenshot session.
 */
export async function seedDemoDevices(): Promise<void> {
  for (const sighting of [...BLE_DEVICES, ...LAN_DEVICES]) {
    deviceRegistry.report(sighting);
  }
  // Write the whole whitelist in one shot: setTrust() reads-modifies-writes the
  // shared list, so firing it per id in parallel would race and keep only one.
  await trustListsSetting.set({ whitelist: WHITELISTED_IDS, blacklist: [] });
}
