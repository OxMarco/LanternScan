import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';

import { errorReporter } from '@/observability/observability';
import { lanLog } from '@/scanner/lan/debugLog';
import { vendorFromMac } from '@/scanner/lan/ouiVendors';
import { gatewayAddress } from '@/scanner/lan/subnet';
import { deviceRegistry } from '@/scanner/registry';
import type { DeviceSighting } from '@/scanner/types';

type WifiDetails = {
  ipAddress?: string | null;
  subnet?: string | null;
  bssid?: string | null;
};

// Builds a gateway sighting from the connected Wi-Fi's BSSID — the AP's MAC,
// the one peer MAC a mobile OS still exposes. We only emit it when the BSSID
// resolves to a known networking vendor: that both gives us something useful to
// say and confirms the address is a real router rather than a masked/random
// BSSID, so we never invent a ghost device. Exported for testing.
export function buildRouterSighting(details: WifiDetails | null): DeviceSighting | undefined {
  if (!details?.bssid || !details.ipAddress || !details.subnet) return undefined;
  const vendor = vendorFromMac(details.bssid);
  if (!vendor) return undefined;
  const gatewayIp = gatewayAddress(details.ipAddress, details.subnet);
  if (!gatewayIp) return undefined;
  return {
    id: `lan:${gatewayIp}`,
    transport: 'lan',
    signals: { ip: gatewayIp, mac: details.bssid, apVendor: vendor },
  };
}

// Identifies the Wi-Fi router/access point from the connected network's BSSID
// and reports it as the gateway device. BSSID is Android-mostly: it needs
// location permission (already requested) and iOS masks it without a special
// entitlement, so this is a no-op there. Mount once on the LAN screen.
export function useRouterIdentity(): void {
  useEffect(() => {
    let cancelled = false;
    void NetInfo.fetch('wifi')
      .then((state) => {
        if (cancelled) return;
        const sighting = buildRouterSighting(state.details as WifiDetails | null);
        if (!sighting) return;
        lanLog(
          `Router identified via BSSID: ${sighting.signals.apVendor} at ${sighting.signals.ip}`
        );
        deviceRegistry.report(sighting);
      })
      .catch((error) => {
        errorReporter.captureException(error, { context: 'router-identity' });
      });
    return () => {
      cancelled = true;
    };
  }, []);
}
