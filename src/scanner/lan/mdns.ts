import { BROWSED_MDNS_SERVICES } from '@/scanner/fingerprint/mdnsServices';
import { lanLog } from '@/scanner/lan/debugLog';
import { deviceRegistry } from '@/scanner/registry';

type ZeroconfService = {
  name?: string;
  fullName?: string;
  host?: string;
  addresses?: string[];
  txt?: Record<string, string> | null;
};

type ZeroconfInstance = {
  on: (event: string, cb: (service: ZeroconfService) => void) => void;
  removeDeviceListeners: () => void;
  scan: (type: string, protocol: string, domain?: string) => void;
  stop: () => void;
};

function serviceType(service: ZeroconfService): string | undefined {
  // fullName looks like "Living Room._airplay._tcp.local."; lowercased so the
  // hint tables and HA rules match regardless of how the device cased it.
  const match = service.fullName?.match(/(_[^.]+\._(?:tcp|udp))/i);
  return match?.[1]?.toLowerCase();
}

function firstIpv4(addresses: string[] | undefined): string | undefined {
  return addresses?.find((address) => /^\d+\.\d+\.\d+\.\d+$/.test(address));
}

// How long to browse one service type before rotating to the next. react-native-
// zeroconf wraps a single NSNetServiceBrowser, and each scan() call stops the
// previous browse (and clears in-flight resolutions), so we can only watch one
// type at a time. The dwell must outlast typical discovery + resolve latency;
// resolved services accumulate in deviceRegistry, which survives the reset.
const MDNS_DWELL_MS = 2500;

function reportService(service: ZeroconfService) {
  const ip = firstIpv4(service.addresses);
  if (!ip) return;
  const type = serviceType(service);
  lanLog(`mDNS resolved ${ip}${type ? ` (${type})` : ''}`);
  deviceRegistry.report({
    id: `lan:${ip}`,
    transport: 'lan',
    signals: {
      ip,
      hostname: service.host,
      name: service.name,
      mdnsServices: type ? [type] : undefined,
      mdnsTxt: service.txt ?? undefined,
    },
  });
}

// Rotation position survives across scans: a 10s scan only gets through ~4
// dwell windows, so restarting at 0 every time would starve every type beyond
// the first few. Continuing where the last scan left off covers the whole list
// over consecutive scans.
let rotationIndex = 0;

export function runMdnsDiscovery(): () => void {
  let zeroconf: ZeroconfInstance;
  try {
    const Zeroconf =
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy load; native module is absent in Expo Go/web/jest
      (require('react-native-zeroconf') as { default: new () => ZeroconfInstance }).default;
    zeroconf = new Zeroconf();
  } catch {
    lanLog('mDNS unavailable (react-native-zeroconf not linked)');
    return () => {};
  }
  zeroconf.on('error', (error) => lanLog(`mDNS error: ${String(error)}`));

  zeroconf.on('resolved', (service) => {
    try {
      reportService(service);
    } catch (error) {
      lanLog(`mDNS response ignored: ${String(error)}`);
    }
  });

  // Only one browse can run at a time (see MDNS_DWELL_MS), so rotate through the
  // service list round-robin, re-covering the whole set every full cycle.
  let interval: ReturnType<typeof setInterval> | undefined;
  const scanNext = (): boolean => {
    // BROWSED_MDNS_SERVICES entries look like "_airplay._tcp"; Zeroconf's native
    // side re-adds the underscores ("_%@._%@."), so strip them from both parts.
    const service = BROWSED_MDNS_SERVICES[rotationIndex % BROWSED_MDNS_SERVICES.length];
    rotationIndex += 1;
    const [type, protocol] = service.split('.');
    try {
      zeroconf.scan(type.replace(/^_/, ''), protocol.replace(/^_/, ''));
      return true;
    } catch {
      lanLog('mDNS unavailable (native scan implementation missing)');
      if (interval) clearInterval(interval);
      return false;
    }
  };
  if (scanNext()) interval = setInterval(scanNext, MDNS_DWELL_MS);

  return () => {
    if (interval) clearInterval(interval);
    try {
      zeroconf.stop();
      zeroconf.removeDeviceListeners();
    } catch {
      // Native module already torn down.
    }
  };
}
