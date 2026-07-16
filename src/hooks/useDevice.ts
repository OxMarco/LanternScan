import { useSyncExternalStore } from 'react';

import { deviceRegistry } from '@/scanner/registry';
import type { Device } from '@/scanner/types';

export function useDevice(id: string): Device | undefined {
  const devices = useSyncExternalStore(
    deviceRegistry.subscribe,
    deviceRegistry.getDevices,
    deviceRegistry.getDevices
  );
  return devices.find((device) => device.id === id);
}
