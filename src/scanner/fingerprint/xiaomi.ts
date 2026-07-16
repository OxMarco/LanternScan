import { decodeBase64 } from '@/scanner/ble/bytes';
import { XIAOMI_PRODUCTS } from '@/scanner/fingerprint/xiaomiProducts.generated';

const MIBEACON_SERVICE = 'fe95';

// Xiaomi MiBeacon service data carries the product ID as a little-endian
// uint16 right after the 2-byte frame control — in cleartext even when the
// sensor payload itself is encrypted.
export function decodeXiaomiProduct(
  serviceData: Record<string, string> | undefined
): string | undefined {
  const payload = decodeBase64(serviceData?.[MIBEACON_SERVICE]);
  if (!payload || payload.length < 4) return undefined;
  return XIAOMI_PRODUCTS[payload[2] | (payload[3] << 8)];
}
