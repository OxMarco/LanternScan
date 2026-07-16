import { getBleManager } from '@/scanner/ble/bleManager';
import { decodeBase64 } from '@/scanner/ble/bytes';
import type { GattDeviceInfo } from '@/scanner/types';

// Standard Bluetooth SIG UUIDs. ble-plx wants the full 128-bit form.
const DEVICE_INFORMATION_SERVICE = '0000180a-0000-1000-8000-00805f9b34fb';
const GENERIC_ACCESS_SERVICE = '00001800-0000-1000-8000-00805f9b34fb';

function sig(short: string): string {
  return `0000${short}-0000-1000-8000-00805f9b34fb`;
}

// Device Information Service string characteristics we want, in the order we
// present them. Each value is a UTF-8 string.
const STRING_CHARS: [key: keyof GattDeviceInfo, uuid: string][] = [
  ['manufacturer', sig('2a29')], // Manufacturer Name String
  ['modelNumber', sig('2a24')], // Model Number String
  ['serialNumber', sig('2a25')], // Serial Number String
  ['firmware', sig('2a26')], // Firmware Revision String
  ['hardware', sig('2a27')], // Hardware Revision String
  ['software', sig('2a28')], // Software Revision String
];

// Generic Access Device Name (0x2A00) — often fuller than the advertised name.
const DEVICE_NAME_CHAR = sig('2a00');

const CONNECT_TIMEOUT_MS = 10_000;

function decodeUtf8(value: string | null | undefined): string | undefined {
  const bytes = decodeBase64(value);
  if (!bytes || bytes.length === 0) return undefined;
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const byte = bytes[i];
    if (byte === 0) break; // NUL-terminated strings are common
    if (byte < 0x80) {
      out += String.fromCharCode(byte);
      i += 1;
    } else if (byte >= 0xc0 && byte < 0xe0 && i + 1 < bytes.length) {
      out += String.fromCharCode(((byte & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
      i += 2;
    } else if (byte >= 0xe0 && i + 2 < bytes.length) {
      out += String.fromCharCode(
        ((byte & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)
      );
      i += 3;
    } else {
      i += 1; // skip a malformed lead byte rather than throw
    }
  }
  const trimmed = out.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// The subset of the ble-plx surface we use, narrowed so the module carries no
// hard dependency on the native types (which are absent in jest/web).
type ConnectedDevice = {
  discoverAllServicesAndCharacteristics: () => Promise<ConnectedDevice>;
  readCharacteristicForService: (
    serviceUuid: string,
    charUuid: string
  ) => Promise<{ value: string | null }>;
};

type Manager = {
  stopDeviceScan: () => void;
  connectToDevice: (id: string, options?: { timeout?: number }) => Promise<ConnectedDevice>;
  cancelDeviceConnection: (id: string) => Promise<unknown>;
};

async function readString(
  device: ConnectedDevice,
  service: string,
  uuid: string
): Promise<string | undefined> {
  try {
    const characteristic = await device.readCharacteristicForService(service, uuid);
    return decodeUtf8(characteristic.value);
  } catch {
    // Characteristic absent, unreadable, or requires bonding — skip it.
    return undefined;
  }
}

// Actively connects to a BLE peripheral and reads its Device Information Service
// (manufacturer / model / firmware …) plus the GAP device name. This is the one
// way to get ground-truth identity rather than guessing from advertised bytes,
// but it is opt-in: connecting costs battery, pauses passive scanning on iOS,
// and only works for connectable peripherals that do not demand bonding.
//
// Returns undefined when BLE is unavailable, the device refuses the connection,
// or it exposes nothing readable. Never throws. Always disconnects.
export async function interrogateBleDevice(deviceId: string): Promise<GattDeviceInfo | undefined> {
  const manager = getBleManager() as Manager | null;
  if (!manager) return undefined;

  // The registry keys BLE devices as "ble:<peripheralId>"; the native APIs want
  // the bare peripheral id.
  const peripheralId = deviceId.startsWith('ble:') ? deviceId.slice('ble:'.length) : deviceId;

  // Free the radio before connecting. Navigating to the detail screen normally
  // blurs the scanner already, but stopping here guarantees an active connect is
  // never contending with a passive scan — which matters most in a crowded RF
  // environment where the scan is saturating the radio.
  try {
    manager.stopDeviceScan();
  } catch {
    return undefined;
  }

  let connected: ConnectedDevice;
  try {
    connected = await manager.connectToDevice(peripheralId, { timeout: CONNECT_TIMEOUT_MS });
    await connected.discoverAllServicesAndCharacteristics();
  } catch {
    return undefined;
  }

  try {
    const info: GattDeviceInfo = {};
    for (const [key, uuid] of STRING_CHARS) {
      const value = await readString(connected, DEVICE_INFORMATION_SERVICE, uuid);
      if (value) info[key] = value;
    }
    const name = await readString(connected, GENERIC_ACCESS_SERVICE, DEVICE_NAME_CHAR);
    if (name) info.name = name;

    return Object.keys(info).length > 0 ? info : undefined;
  } finally {
    try {
      await manager.cancelDeviceConnection(peripheralId);
    } catch {
      // Already disconnected.
    }
  }
}

// Exposed for unit testing the decode path without a radio.
export const __testables = { decodeUtf8 };
