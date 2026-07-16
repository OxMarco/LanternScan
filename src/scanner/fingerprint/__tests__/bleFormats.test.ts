import { decodeBleFormat } from '@/scanner/fingerprint/bleFormats';

const b64 = (bytes: number[]) => Buffer.from(bytes).toString('base64');

describe('decodeBleFormat', () => {
  it('extracts product models from common BLE sensor local names', () => {
    expect(decodeBleFormat({ name: 'GVH5075_6C11' })).toBe('Govee GVH5075');
    expect(decodeBleFormat({ name: 'IBS-TH2' })).toBe('Inkbird IBS-TH2');
  });

  it('distinguishes Ruuvi advertisement formats', () => {
    expect(
      decodeBleFormat({ manufacturerCompanyId: 0x0499, manufacturerData: b64([0x99, 0x04, 5]) })
    ).toBe('RuuviTag (RAWv2)');
  });

  it('recognizes standard beacon frames', () => {
    expect(
      decodeBleFormat({
        manufacturerCompanyId: 0x004c,
        manufacturerData: b64([0x4c, 0x00, 0x02, 0x15]),
      })
    ).toBe('iBeacon');
  });
});
