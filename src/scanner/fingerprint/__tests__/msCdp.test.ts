import { decodeMsCdpDeviceType, MICROSOFT_COMPANY_ID } from '@/scanner/fingerprint/msCdp';

// Manufacturer data: company ID (LE) + Scenario_Type + Version_and_Device_Type.
function beacon(deviceType: number, scenario = 0x01, version = 0b001): string {
  return Buffer.from([0x06, 0x00, scenario, (version << 5) | deviceType, 0x21, 0x0a]).toString(
    'base64'
  );
}

describe('decodeMsCdpDeviceType', () => {
  it('decodes the Windows desktop SKU', () => {
    expect(decodeMsCdpDeviceType(MICROSOFT_COMPANY_ID, beacon(9))).toBe('Windows desktop PC');
  });

  it('decodes Xbox and Surface Hub SKUs', () => {
    expect(decodeMsCdpDeviceType(MICROSOFT_COMPANY_ID, beacon(1))).toBe('Xbox One');
    expect(decodeMsCdpDeviceType(MICROSOFT_COMPANY_ID, beacon(14))).toBe('Surface Hub');
  });

  it('ignores other manufacturers and non-Bluetooth scenarios', () => {
    expect(decodeMsCdpDeviceType(0x004c, beacon(9))).toBeUndefined();
    expect(decodeMsCdpDeviceType(MICROSOFT_COMPANY_ID, beacon(9, 0x02))).toBeUndefined();
  });

  it('ignores unknown beacon versions and unknown SKUs', () => {
    expect(decodeMsCdpDeviceType(MICROSOFT_COMPANY_ID, beacon(9, 0x01, 0b010))).toBeUndefined();
    expect(decodeMsCdpDeviceType(MICROSOFT_COMPANY_ID, beacon(30))).toBeUndefined();
  });
});
