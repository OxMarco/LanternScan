import { decodeBase64 } from '@/scanner/ble/bytes';
import type { DeviceGuess } from '@/scanner/types';

// Well-known service-data payloads that identify a device class outright.
// (Tracker frames — Find My Device on 0xFEAA, SmartTag on 0xFD5A, … — are
// handled by trackers.ts and take precedence in the guess engine.)
export function serviceDataHint(uuid: string, payloadBase64: string): DeviceGuess | undefined {
  if (uuid === 'fd6f') {
    return {
      label: 'Phone (Exposure Notification)',
      confidence: 0.6,
      reason: 'Broadcasts Exposure Notification service data',
    };
  }
  if (uuid === 'fcd2') {
    return {
      label: 'BTHome sensor',
      confidence: 0.7,
      reason: 'Broadcasts BTHome service data',
    };
  }
  if (uuid === 'fff6') {
    // Matter BLE commissioning advertisement: opcode 0x00, then discriminator
    // (12 bits of an LE u16), vendor ID (LE u16), product ID (LE u16), flags.
    const payload = decodeBase64(payloadBase64);
    if (!payload || payload.length < 8 || payload[0] !== 0x00) return undefined;
    const vendorId = payload[3] | (payload[4] << 8);
    const productId = payload[5] | (payload[6] << 8);
    return {
      label: 'Matter smart-home device (pairing mode)',
      confidence: 0.75,
      reason: `Matter commissioning beacon (vendor 0x${hex16(vendorId)}, product 0x${hex16(productId)})`,
    };
  }
  if (uuid === 'feaa') {
    const payload = decodeBase64(payloadBase64);
    if (!payload || payload.length === 0) return undefined;
    // Frame types: 0x00 UID, 0x10 URL, 0x20 TLM, 0x30 EID. 0x40+ is Google
    // Find My Device, which trackers.ts identifies more specifically.
    if (payload[0] <= 0x30 && (payload[0] & 0x0f) === 0) {
      return {
        label: 'Eddystone beacon',
        confidence: 0.75,
        reason: 'Broadcasts an Eddystone frame',
      };
    }
  }
  return undefined;
}

function hex16(value: number): string {
  return value.toString(16).padStart(4, '0');
}
