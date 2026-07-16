import { BLE_SERVICE_NAMES } from '@/scanner/fingerprint/bluetoothNumbers.generated';

// The Bluetooth base UUID: standard 16-bit service UUIDs are advertised in this
// full 128-bit form. Collapse them back to the 16-bit key the dataset uses.
const BASE_UUID = /^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/;

export function normalizeServiceUuid(uuid: string): string {
  const lower = uuid.trim().toLowerCase();
  const base = BASE_UUID.exec(lower);
  if (base) return base[1];
  if (/^[0-9a-f]{4}$/.test(lower)) return lower;
  return lower;
}

// Human-readable GATT service name (e.g. "Heart Rate"), or undefined if the UUID
// is vendor-specific / unknown.
export function serviceName(uuid: string): string | undefined {
  return BLE_SERVICE_NAMES[normalizeServiceUuid(uuid)];
}

type ServiceDeviceHint = {
  label: string;
  confidence: number;
};

// A curated subset of GATT services that betray what kind of device is
// advertising them. Most services (Battery, Device Information, Generic Access)
// say nothing about device type and are deliberately omitted — advertising them
// only earns the generic serviceName() label, not a device guess.
const SERVICE_DEVICE_HINTS: Record<string, ServiceDeviceHint> = {
  '180d': { label: 'Heart-rate wearable / fitness tracker', confidence: 0.6 },
  '1814': { label: 'Running sensor (foot pod / watch)', confidence: 0.6 },
  '1816': { label: 'Cycling sensor', confidence: 0.65 },
  '1818': { label: 'Cycling power meter', confidence: 0.65 },
  '1826': { label: 'Fitness machine (treadmill / trainer)', confidence: 0.6 },
  '1808': { label: 'Glucose meter', confidence: 0.6 },
  '1809': { label: 'Health thermometer', confidence: 0.55 },
  '1810': { label: 'Blood-pressure monitor', confidence: 0.6 },
  '1812': { label: 'Keyboard / mouse / controller (HID)', confidence: 0.6 },
  '1802': { label: 'Item tracker / proximity tag', confidence: 0.4 },
  '1803': { label: 'Item tracker / proximity tag', confidence: 0.4 },
  '183a': { label: 'Insulin delivery device', confidence: 0.6 },
  '1827': { label: 'Mesh smart-home node', confidence: 0.5 },
  '1828': { label: 'Mesh smart-home node', confidence: 0.5 },
};

export function serviceDeviceHint(uuid: string): ServiceDeviceHint | undefined {
  return SERVICE_DEVICE_HINTS[normalizeServiceUuid(uuid)];
}
