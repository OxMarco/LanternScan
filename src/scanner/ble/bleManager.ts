import type { BleManager } from 'react-native-ble-plx';

let manager: BleManager | null = null;
let managerFailed = false;

// The native module is absent in Expo Go and on web; construct lazily so the
// rest of the app still renders there. A single shared manager is used for both
// passive scanning (useBleScanner) and active GATT interrogation
// (gattInterrogate) — two managers fight over the radio on iOS.
export function getBleManager(): BleManager | null {
  if (manager || managerFailed) return manager;
  try {
    const { BleManager: Manager } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy load; native module is absent in Expo Go/web/jest
      require('react-native-ble-plx') as typeof import('react-native-ble-plx');
    manager = new Manager();
  } catch {
    managerFailed = true;
  }
  return manager;
}
