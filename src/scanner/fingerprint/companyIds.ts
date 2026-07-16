import { BLE_COMPANY_NAMES } from '@/scanner/fingerprint/bluetoothNumbers.generated';

// The full Bluetooth SIG assigned company identifiers ship in
// bluetoothNumbers.generated.ts (regenerate with
// scripts/generate-bluetooth-numbers.mjs).
export function companyName(companyId: number | undefined): string | undefined {
  return companyId === undefined ? undefined : BLE_COMPANY_NAMES[companyId];
}
