import { decodeBase64 } from '@/scanner/ble/bytes';
import { manufacturerPayload } from '@/scanner/ble/manufacturerData';
import { normalizeServiceUuid } from '@/scanner/fingerprint/serviceUuids';
import type { DeviceSignals } from '@/scanner/types';

export type TrackerMatch = {
  label: string;
  reason: string;
};

const APPLE_COMPANY_ID = 0x004c;

// Detection patterns ported from seemoo-lab/AirGuard (Apache-2.0), which faces
// the same constraint we do (no stable MAC addresses) and keys everything on
// advertisement content instead.

function detectAppleFindMy(signals: DeviceSignals): TrackerMatch | undefined {
  if (signals.manufacturerCompanyId !== APPLE_COMPANY_ID) return undefined;
  const payload = manufacturerPayload(signals.manufacturerData);
  // Offline-finding frame: type 0x12, status byte bits 0x18 == 0x10.
  if (!payload || payload.length < 3) return undefined;
  if (payload[0] !== 0x12 || (payload[2] & 0x18) !== 0x10) return undefined;
  const isAirTag = payload[1] === 0x19;
  return {
    label: isAirTag ? 'Apple AirTag' : 'Apple Find My tracker',
    reason: 'Broadcasts an Apple Find My offline-finding frame',
  };
}

function detectGoogleFindMy(serviceData: Map<string, Uint8Array>): TrackerMatch | undefined {
  const payload = serviceData.get('feaa');
  // 0xFEAA is shared with Eddystone; frame type 0x40/0x41 is Find My Device.
  if (!payload || (payload[0] !== 0x40 && payload[0] !== 0x41)) return undefined;
  return {
    label: 'Google Find My Device tracker',
    reason: 'Broadcasts a Find My Device network frame',
  };
}

function detectSamsungTracker(serviceData: Map<string, Uint8Array>): TrackerMatch | undefined {
  const payload = serviceData.get('fd5a');
  if (!payload || payload.length === 0 || (payload[0] & 0xf8) !== 0x10) return undefined;
  return {
    label: 'Samsung SmartTag',
    reason: 'Broadcasts a Samsung offline-finding frame',
  };
}

function detectTile(serviceData: Map<string, Uint8Array>) {
  const payload = serviceData.get('feed');
  if (payload && payload.length >= 2 && payload[0] === 0x02 && payload[1] === 0x00) {
    return { label: 'Tile tracker', reason: 'Broadcasts a Tile frame' };
  }
  return undefined;
}

export function detectTracker(signals: DeviceSignals): TrackerMatch | undefined {
  const serviceData = new Map<string, Uint8Array>();
  for (const [uuid, payload] of Object.entries(signals.serviceData ?? {})) {
    const bytes = decodeBase64(payload);
    if (bytes) serviceData.set(normalizeServiceUuid(uuid), bytes);
  }
  const advertisedServices = new Set(
    (signals.serviceUUIDs ?? []).map((uuid) => normalizeServiceUuid(uuid))
  );

  const match =
    detectAppleFindMy(signals) ??
    detectGoogleFindMy(serviceData) ??
    detectSamsungTracker(serviceData) ??
    detectTile(serviceData);
  if (match) return match;

  if (serviceData.has('fd69')) {
    return {
      label: 'Samsung device (Find My Mobile)',
      reason: 'Broadcasts a Samsung Find My Mobile frame',
    };
  }
  if (serviceData.has('fe33') || advertisedServices.has('fe33')) {
    return { label: 'Chipolo tracker', reason: 'Advertises the Chipolo finding service' };
  }
  if (serviceData.has('fa25') || advertisedServices.has('fa25')) {
    return { label: 'Pebblebee tracker', reason: 'Advertises the Pebblebee finding service' };
  }
  return undefined;
}
