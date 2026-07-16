import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { errorReporter } from '@/observability/observability';
import { deviceRegistry } from '@/scanner/registry';
import type { Device, Transport } from '@/scanner/types';

function ipSortKey(ip: string | undefined): number {
  if (!ip) return Number.MAX_SAFE_INTEGER;
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return Number.MAX_SAFE_INTEGER;
  }
  return ((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3];
}

function compareDevices(a: Device, b: Device): number {
  const byDistance = (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity);
  if (byDistance !== 0) return byDistance;
  const byIp = ipSortKey(a.signals.ip) - ipSortKey(b.signals.ip);
  if (byIp !== 0) return byIp;
  return a.id.localeCompare(b.id);
}

export function useDevices(transport: Transport): Device[] {
  useEffect(() => {
    void deviceRegistry.hydrate().catch((error) => {
      errorReporter.captureException(error, { context: 'device-registry-hydrate' });
    });
  }, []);

  const all = useSyncExternalStore(
    deviceRegistry.subscribe,
    deviceRegistry.getDevices,
    deviceRegistry.getDevices
  );

  return useMemo(
    () => all.filter((device) => device.transport === transport).sort(compareDevices),
    [all, transport]
  );
}
