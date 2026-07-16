import { decodeBase64 } from '@/scanner/ble/bytes';

// BLE manufacturer-specific data starts with the Bluetooth SIG company
// identifier as a little-endian uint16. ble-plx hands us the payload base64
// encoded.
export function parseCompanyId(manufacturerData: string | null | undefined): number | undefined {
  const bytes = decodeBase64(manufacturerData);
  if (!bytes || bytes.length < 2) return undefined;
  return bytes[0] | (bytes[1] << 8);
}

// The vendor payload that follows the two company-identifier bytes.
export function manufacturerPayload(
  manufacturerData: string | null | undefined
): Uint8Array | undefined {
  const bytes = decodeBase64(manufacturerData);
  if (!bytes || bytes.length < 2) return undefined;
  return bytes.subarray(2);
}
