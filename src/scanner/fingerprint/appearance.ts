import { BLE_APPEARANCE_NAMES } from '@/scanner/fingerprint/bluetoothNumbers.generated';

// GAP Appearance is a 16-bit value: category in the high 10 bits, subcategory
// in the low 6. Fall back to the bare category when the exact subcategory is
// not registered.
export function appearanceName(value: number | undefined): string | undefined {
  if (value === undefined || value === 0) return undefined;
  return BLE_APPEARANCE_NAMES[value] ?? BLE_APPEARANCE_NAMES[value & 0xffc0];
}
