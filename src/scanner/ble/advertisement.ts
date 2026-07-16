import { decodeBase64 } from '@/scanner/ble/bytes';

// GAP advertising-data structure type for Appearance (Core Spec Supplement).
const AD_TYPE_APPEARANCE = 0x19;

// Walks the raw advertising report (length/type/data structures) looking for
// the Appearance field. ble-plx only exposes rawScanRecord on Android; iOS
// strips unrecognised AD types before apps see them, so this returning
// undefined there is expected.
export function parseAppearance(rawScanRecord: string | null | undefined): number | undefined {
  const bytes = decodeBase64(rawScanRecord);
  if (!bytes) return undefined;
  let offset = 0;
  while (offset < bytes.length) {
    const length = bytes[offset];
    if (length === 0) break; // zero-length structure terminates the record
    const type = bytes[offset + 1];
    if (type === AD_TYPE_APPEARANCE && length >= 3) {
      return bytes[offset + 2] | (bytes[offset + 3] << 8);
    }
    offset += length + 1;
  }
  return undefined;
}
