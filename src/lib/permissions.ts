import { PermissionsAndroid, Platform } from 'react-native';

import { getBleManager } from '@/scanner/ble/bleManager';
import { runMdnsDiscovery } from '@/scanner/lan/mdns';

export type PermissionOutcome = 'granted' | 'denied' | 'unavailable';

// How long to leave a throwaway browse running so the OS permission dialog has
// time to appear and the user time to respond.
const PROMPT_WINDOW_MS = 4000;

// iOS keeps the central manager in 'Unknown' while the Bluetooth dialog is on
// screen, so the wait has to outlast a user reading it. Only a user who walks
// away hits this.
const BLUETOOTH_PROMPT_TIMEOUT_MS = 60_000;

// Android runtime permissions required to scan for BLE devices. On iOS this is a
// no-op — the system prompts on first central-manager use. Shared by the BLE
// scanner and the onboarding flow so the permission list stays in one place.
export async function requestAndroidBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : 31;
  const permissions =
    apiLevel >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  try {
    const results = await PermissionsAndroid.requestMultiple(permissions);
    return Object.values(results).every((result) => result === PermissionsAndroid.RESULTS.GRANTED);
  } catch {
    return false;
  }
}

// Surface the Bluetooth permission prompt during onboarding. Android uses the
// runtime dialog. iOS prompts as soon as a central manager exists and reports
// the answer as a state change, so we hold the app's shared manager open until
// its state settles: destroying it or racing a scan against the still-'Unknown'
// state dismisses the dialog before the user ever sees it, which is how the
// prompt used to leak out of onboarding and onto the first tab scan.
export async function requestBluetoothPermission(): Promise<PermissionOutcome> {
  if (Platform.OS === 'android') {
    return (await requestAndroidBlePermissions()) ? 'granted' : 'denied';
  }

  const manager = getBleManager();
  if (!manager) return 'unavailable';

  return new Promise<PermissionOutcome>((resolve) => {
    let settled = false;
    let subscription: { remove: () => void } | undefined;
    const finish = (outcome: PermissionOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subscription?.remove();
      resolve(outcome);
    };

    const timer = setTimeout(() => finish('granted'), BLUETOOTH_PROMPT_TIMEOUT_MS);

    subscription = manager.onStateChange((state) => {
      switch (state) {
        case 'Unauthorized':
          finish('denied');
          break;
        case 'Unsupported':
          finish('unavailable');
          break;
        // Reaching the radio at all means authorization is settled, whether or
        // not the user happens to have Bluetooth switched on right now.
        case 'PoweredOn':
        case 'PoweredOff':
          finish('granted');
          break;
        default:
          // 'Unknown' or 'Resetting': CoreBluetooth is still starting up, or
          // the dialog is on screen waiting for an answer. Keep waiting.
          break;
      }
    }, true);
    // onStateChange emits the current state asynchronously, but guard anyway so
    // a synchronous emit does not leave the listener attached.
    if (settled) subscription.remove();
  });
}

// Surface the iOS Local Network permission prompt by starting a short Bonjour
// browse. Android grants local-network access at install time via the manifest,
// so there is nothing to request there. iOS exposes no API to read the result,
// so a resolved 'granted' means "the prompt was shown", not a confirmed grant.
export async function requestLocalNetworkPermission(): Promise<PermissionOutcome> {
  if (Platform.OS !== 'ios') return 'granted';

  let stop: () => void;
  try {
    stop = runMdnsDiscovery();
  } catch {
    return 'unavailable';
  }

  return new Promise<PermissionOutcome>((resolve) => {
    setTimeout(() => {
      try {
        stop();
      } catch {
        // Discovery already torn down.
      }
      resolve('granted');
    }, PROMPT_WINDOW_MS);
  });
}
