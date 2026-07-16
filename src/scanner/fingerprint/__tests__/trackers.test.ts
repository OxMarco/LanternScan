import { detectTracker } from '@/scanner/fingerprint/trackers';
import type { DeviceSignals } from '@/scanner/types';

const b64 = (bytes: number[]) => Buffer.from(bytes).toString('base64');

describe('detectTracker', () => {
  it('identifies an AirTag from the Find My offline-finding frame', () => {
    const signals: DeviceSignals = {
      manufacturerCompanyId: 0x004c,
      manufacturerData: b64([0x4c, 0x00, 0x12, 0x19, 0x10, 0x00]),
    };
    expect(detectTracker(signals)?.label).toBe('Apple AirTag');
  });

  it('identifies a non-AirTag Find My tracker', () => {
    const signals: DeviceSignals = {
      manufacturerCompanyId: 0x004c,
      manufacturerData: b64([0x4c, 0x00, 0x12, 0x02, 0x10, 0x00]),
    };
    expect(detectTracker(signals)?.label).toBe('Apple Find My tracker');
  });

  it('does not flag ordinary Apple advertisements', () => {
    const signals: DeviceSignals = {
      manufacturerCompanyId: 0x004c,
      manufacturerData: b64([0x4c, 0x00, 0x10, 0x05, 0x01, 0x18]),
    };
    expect(detectTracker(signals)).toBeUndefined();
  });

  it('identifies Google Find My Device frames on 0xFEAA but not Eddystone', () => {
    expect(detectTracker({ serviceData: { feaa: b64([0x40, 0x00, 0x01]) } })?.label).toBe(
      'Google Find My Device tracker'
    );
    expect(detectTracker({ serviceData: { feaa: b64([0x00, 0xe0, 0x01]) } })).toBeUndefined();
  });

  it('identifies Samsung SmartTag frames', () => {
    expect(detectTracker({ serviceData: { fd5a: b64([0x12, 0x01]) } })?.label).toBe(
      'Samsung SmartTag'
    );
    // Status bits outside the offline-finding pattern.
    expect(detectTracker({ serviceData: { fd5a: b64([0x20, 0x01]) } })).toBeUndefined();
  });

  it('identifies Tile, Chipolo and Pebblebee', () => {
    expect(detectTracker({ serviceData: { feed: b64([0x02, 0x00, 0x41]) } })?.label).toBe(
      'Tile tracker'
    );
    expect(detectTracker({ serviceData: { fe33: b64([0x01]) } })?.label).toBe('Chipolo tracker');
    expect(detectTracker({ serviceUUIDs: ['0000FA25-0000-1000-8000-00805F9B34FB'] })?.label).toBe(
      'Pebblebee tracker'
    );
  });

  it('returns undefined for signal-less devices', () => {
    expect(detectTracker({})).toBeUndefined();
  });
});
