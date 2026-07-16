import { manufacturerPayload } from '@/scanner/ble/manufacturerData';
import type { DeviceGuess, DeviceSignals } from '@/scanner/types';

// Apple Continuity: manufacturer data under company ID 0x004C carrying a
// sequence of type/length/value messages. The wire format is a public fact,
// documented across academic work (Celosia & Cunche, "Discontinued Privacy")
// and protocol write-ups; this is an independent implementation of it.
//
// Two message types are deliberately NOT handled here because narrower
// detectors own them: 0x02 iBeacon (bleFormats.ts) and 0x12 Find My
// offline-finding (trackers.ts, which separates AirTags from phones).
const APPLE_COMPANY_ID = 0x004c;

// Proximity-pairing device models (big-endian u16 following the pairing-state
// byte). Curated to the widely corroborated identifiers; unlisted models still
// get the generic audio label below.
const PROXIMITY_MODELS: Record<number, string> = {
  0x0220: 'Apple AirPods',
  0x0f20: 'Apple AirPods (2nd generation)',
  0x1320: 'Apple AirPods (3rd generation)',
  0x0e20: 'Apple AirPods Pro',
  0x1420: 'Apple AirPods Pro (2nd generation)',
  0x2420: 'Apple AirPods Pro (2nd generation, USB-C)',
  0x0a20: 'Apple AirPods Max',
  0x0320: 'Beats Powerbeats3',
  0x0b20: 'Beats Powerbeats Pro',
  0x0520: 'BeatsX',
  0x0620: 'Beats Solo3',
  0x0920: 'Beats Studio3',
  0x0c20: 'Beats Solo Pro',
  0x1020: 'Beats Flex',
};

function hintForMessage(type: number, data: Uint8Array): DeviceGuess | undefined {
  switch (type) {
    case 0x05:
      return {
        label: 'Apple device (AirDrop active)',
        confidence: 0.5,
        reason: 'AirDrop beacon',
      };
    case 0x07: {
      const model = data.length >= 3 ? PROXIMITY_MODELS[(data[1] << 8) | data[2]] : undefined;
      return model
        ? { label: model, confidence: 0.85, reason: 'Apple proximity-pairing beacon' }
        : {
            label: 'Apple / Beats earbuds or headphones',
            confidence: 0.6,
            reason: 'Apple proximity-pairing beacon',
          };
    }
    case 0x09:
      return {
        label: 'AirPlay receiver (Apple TV / speaker)',
        confidence: 0.55,
        reason: 'AirPlay target beacon',
      };
    case 0x0b:
      return { label: 'Apple Watch', confidence: 0.7, reason: 'Apple Watch companion beacon' };
    case 0x0c:
      return { label: 'Apple device', confidence: 0.45, reason: 'Handoff beacon' };
    case 0x0e:
      return {
        label: 'Apple iPhone / iPad (personal hotspot)',
        confidence: 0.7,
        reason: 'Personal-hotspot beacon',
      };
    case 0x0f:
      return { label: 'Apple device', confidence: 0.4, reason: 'Nearby-action beacon' };
    case 0x10:
      // The always-on beacon every awake iPhone / iPad / Mac / Watch emits.
      // The status payload does not reliably separate the device classes, so
      // this stays a generic (but named) Apple sighting.
      return { label: 'Apple device', confidence: 0.45, reason: 'Nearby-info beacon' };
    default:
      return undefined;
  }
}

export function appleContinuityHints(signals: DeviceSignals): DeviceGuess[] {
  if (signals.manufacturerCompanyId !== APPLE_COMPANY_ID) return [];
  const payload = manufacturerPayload(signals.manufacturerData);
  if (!payload || payload.length < 2) return [];

  const hints: DeviceGuess[] = [];
  const seenTypes = new Set<number>();
  let offset = 0;
  while (offset + 2 <= payload.length) {
    const type = payload[offset];
    const length = payload[offset + 1];
    // Truncated message: stop walking rather than misread the tail.
    if (offset + 2 + length > payload.length) break;
    if (!seenTypes.has(type)) {
      seenTypes.add(type);
      const hint = hintForMessage(type, payload.subarray(offset + 2, offset + 2 + length));
      if (hint) hints.push(hint);
    }
    offset += 2 + length;
  }
  return hints;
}
