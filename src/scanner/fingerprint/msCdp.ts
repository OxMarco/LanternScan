import { manufacturerPayload } from '@/scanner/ble/manufacturerData';

export const MICROSOFT_COMPANY_ID = 0x0006;

// Device Type SKU values from [MS-CDP] 2.2.2.2.2 / the Bluetooth advertising
// beacon (learn.microsoft.com/en-us/openspecs/windows_protocols/ms-cdp).
const DEVICE_TYPES: Record<number, string> = {
  1: 'Xbox One',
  6: 'iPhone (Microsoft apps)',
  7: 'iPad (Microsoft apps)',
  8: 'Android device (Microsoft apps)',
  9: 'Windows desktop PC',
  11: 'Windows 10 phone',
  12: 'Linux device',
  13: 'Windows IoT device',
  14: 'Surface Hub',
  15: 'Windows laptop',
  16: 'Windows tablet',
};

// Every Windows 10/11 machine with Bluetooth broadcasts a Connected Devices
// Platform beacon; one payload byte states exactly what kind of device it is.
export function decodeMsCdpDeviceType(
  companyId: number | undefined,
  manufacturerData: string | undefined
): string | undefined {
  if (companyId !== MICROSOFT_COMPANY_ID) return undefined;
  const payload = manufacturerPayload(manufacturerData);
  if (!payload || payload.length < 2) return undefined;
  if (payload[0] !== 0x01) return undefined; // Scenario_Type: 1 = Bluetooth
  if (payload[1] >> 5 !== 0b001) return undefined; // beacon version
  return DEVICE_TYPES[payload[1] & 0x1f];
}
