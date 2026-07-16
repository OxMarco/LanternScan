import { appleContinuityHints } from '@/scanner/fingerprint/appleContinuity';
import type { DeviceSignals } from '@/scanner/types';

// ble-plx delivers manufacturer data base64-encoded with the little-endian
// company ID prefixed; build frames the same way the radio would.
function appleFrame(...messages: number[][]): DeviceSignals {
  const bytes = [0x4c, 0x00, ...messages.flat()];
  return {
    manufacturerCompanyId: 0x004c,
    manufacturerData: Buffer.from(bytes).toString('base64'),
  };
}

function tlv(type: number, data: number[]): number[] {
  return [type, data.length, ...data];
}

describe('appleContinuityHints', () => {
  it('identifies AirPods Pro from a proximity-pairing message', () => {
    const signals = appleFrame(
      tlv(0x07, [0x01, 0x0e, 0x20, 0x55, 0xaa, 0x56, 0x31, 0x00, 0x00, 0x6f])
    );
    const hints = appleContinuityHints(signals);
    expect(hints).toEqual([
      expect.objectContaining({ label: 'Apple AirPods Pro', confidence: 0.85 }),
    ]);
  });

  it('falls back to a generic audio label for unknown pairing models', () => {
    const signals = appleFrame(tlv(0x07, [0x01, 0xff, 0xff, 0x00]));
    expect(appleContinuityHints(signals)[0]?.label).toBe('Apple / Beats earbuds or headphones');
  });

  it('reads every message in a combined nearby-info + handoff frame', () => {
    const signals = appleFrame(
      tlv(
        0x0c,
        [0x00, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77]
      ),
      tlv(0x10, [0x01, 0x1c, 0xf0, 0xaa, 0x55])
    );
    const hints = appleContinuityHints(signals);
    expect(hints.map((hint) => hint.reason)).toEqual(['Handoff beacon', 'Nearby-info beacon']);
  });

  it('recognizes the Apple Watch companion beacon', () => {
    const signals = appleFrame(tlv(0x0b, [0x01, 0x02, 0x03]));
    expect(appleContinuityHints(signals)[0]?.label).toBe('Apple Watch');
  });

  it('leaves iBeacon and Find My frames to their dedicated detectors', () => {
    const iBeacon = appleFrame(
      tlv(
        0x02,
        Array.from({ length: 0x15 }, () => 0)
      )
    );
    const findMy = appleFrame(tlv(0x12, [0x19, 0x10, 0x00]));
    expect(appleContinuityHints(iBeacon)).toEqual([]);
    expect(appleContinuityHints(findMy)).toEqual([]);
  });

  it('stops at a truncated message instead of misreading the tail', () => {
    const signals = appleFrame([0x10, 0x20, 0x01]);
    expect(appleContinuityHints(signals)).toEqual([]);
  });

  it('ignores non-Apple manufacturer data', () => {
    const signals: DeviceSignals = {
      manufacturerCompanyId: 0x0006,
      manufacturerData: Buffer.from([0x06, 0x00, 0x01, 0x09]).toString('base64'),
    };
    expect(appleContinuityHints(signals)).toEqual([]);
  });
});
