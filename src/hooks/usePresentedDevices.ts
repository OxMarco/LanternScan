import { useMemo } from 'react';

import { useDevices } from '@/hooks/useDevices';
import { presentDevice, type DevicePresentation } from '@/scanner/present';
import { deviceRegistry } from '@/scanner/registry';
import { useTrustLists } from '@/scanner/trustStore';
import type { Transport } from '@/scanner/types';

export function usePresentedDevices(transport: Transport): DevicePresentation[] {
  const devices = useDevices(transport);
  const lists = useTrustLists();

  return useMemo(
    () => devices.map((device) => presentDevice(device, lists, deviceRegistry.isNew(device.id))),
    [devices, lists]
  );
}
