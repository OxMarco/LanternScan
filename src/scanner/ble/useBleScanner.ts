import { useCallback, useEffect, useRef, useState } from 'react';

import { requestAndroidBlePermissions } from '@/lib/permissions';
import { errorReporter } from '@/observability/observability';
import { parseAppearance } from '@/scanner/ble/advertisement';
import { getBleManager } from '@/scanner/ble/bleManager';
import { parseCompanyId } from '@/scanner/ble/manufacturerData';
import { SCAN_DURATION_MS } from '@/scanner/constants';
import { normalizeServiceUuid } from '@/scanner/fingerprint/serviceUuids';
import { deviceRegistry } from '@/scanner/registry';

export type BleScanStatus =
  'idle' | 'scanning' | 'unsupported' | 'unauthorized' | 'poweredOff' | 'error';

// ble-plx BleErrorCode values for the adapter states we can explain to the
// user. Anything else (a transient scan failure, a resetting stack) just drops
// us back to idle.
const BLE_ERROR_STATUS: Record<number, BleScanStatus> = {
  100: 'unsupported', // BluetoothUnsupported
  101: 'unauthorized', // BluetoothUnauthorized
  102: 'poweredOff', // BluetoothPoweredOff
  601: 'unauthorized', // LocationServicesDisabled (Android)
};

export function useBleScanner() {
  const [status, setStatus] = useState<BleScanStatus>('idle');
  const scanningRef = useRef(false);
  // start() awaits permissions and the adapter state before it touches the
  // radio. Every start and stop bumps this counter so a start that resolves
  // after the user stopped or left the tab can tell it is stale and bail out
  // instead of kicking off a scan nobody is watching.
  const generationRef = useRef(0);
  const expiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    generationRef.current += 1;
    if (expiryRef.current) {
      clearTimeout(expiryRef.current);
      expiryRef.current = null;
    }
    if (!scanningRef.current) return;
    scanningRef.current = false;
    try {
      getBleManager()?.stopDeviceScan();
    } catch (error) {
      errorReporter.captureException(error, { context: 'ble-scan-cleanup' });
    }
    setStatus('idle');
  }, []);

  const start = useCallback(async () => {
    const bleManager = getBleManager();
    if (!bleManager) {
      setStatus('unsupported');
      return;
    }
    if (scanningRef.current) return;

    generationRef.current += 1;
    const generation = generationRef.current;
    const stale = () => generation !== generationRef.current;

    try {
      const granted = await requestAndroidBlePermissions();
      if (stale()) return;
      if (!granted) {
        setStatus('unauthorized');
        return;
      }

      const state = await bleManager.state();
      if (stale()) return;
      if (state === 'PoweredOff') {
        setStatus('poweredOff');
        return;
      }
      if (state === 'Unauthorized') {
        setStatus('unauthorized');
        return;
      }
      if (state === 'Unsupported') {
        setStatus('unsupported');
        return;
      }

      scanningRef.current = true;
      setStatus('scanning');
      deviceRegistry.beginScan('ble');
      bleManager.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
        if (stale()) return;
        if (error) {
          scanningRef.current = false;
          setStatus(BLE_ERROR_STATUS[error.errorCode] ?? 'error');
          return;
        }
        if (!device) return;
        try {
          // Service-data payloads keyed by normalized UUID so decoders can look up
          // short IDs like "fe2c" regardless of the 128-bit form ble-plx reports.
          let serviceData: Record<string, string> | undefined;
          if (device.serviceData) {
            serviceData = {};
            for (const [uuid, payload] of Object.entries(device.serviceData)) {
              serviceData[normalizeServiceUuid(uuid)] = payload;
            }
          }
          deviceRegistry.report({
            id: `ble:${device.id}`,
            transport: 'ble',
            signals: {
              name: device.name ?? device.localName ?? undefined,
              rssi: device.rssi ?? undefined,
              txPower: device.txPowerLevel ?? undefined,
              manufacturerCompanyId: parseCompanyId(device.manufacturerData),
              manufacturerData: device.manufacturerData ?? undefined,
              serviceData,
              appearance: parseAppearance(device.rawScanRecord),
              serviceUUIDs: device.serviceUUIDs ?? undefined,
            },
          });
        } catch (callbackError) {
          errorReporter.captureException(callbackError, { context: 'ble-scan-device' });
        }
      });

      expiryRef.current = setTimeout(stop, SCAN_DURATION_MS);
    } catch (error) {
      if (stale()) return;
      scanningRef.current = false;
      errorReporter.captureException(error, { context: 'ble-scan-start' });
      setStatus('error');
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { status, start, stop };
}
