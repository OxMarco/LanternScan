import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useRef, useState } from 'react';

import { errorReporter } from '@/observability/observability';
import { SCAN_DURATION_MS } from '@/scanner/constants';
import { lanLog } from '@/scanner/lan/debugLog';
import { createHttpProber } from '@/scanner/lan/httpProbe';
import { runMdnsDiscovery } from '@/scanner/lan/mdns';
import { runMdnsQuery } from '@/scanner/lan/mdnsQuery';
import {
  createMdnsQuerySocket,
  createSsdpDeps,
  createTcpBannerProber,
  createTcpConnector,
} from '@/scanner/lan/nativeAdapters';
import { runSsdpDiscovery } from '@/scanner/lan/ssdp';
import { enumerateHosts } from '@/scanner/lan/subnet';
import { sweepHosts } from '@/scanner/lan/tcpSweep';
import { deviceRegistry } from '@/scanner/registry';

export type LanScanStatus = 'idle' | 'scanning' | 'offline' | 'error';

type WifiDetails = { ipAddress?: string | null; subnet?: string | null };

export function useLanScanner() {
  const [status, setStatus] = useState<LanScanStatus>('idle');
  const cleanupsRef = useRef<(() => void)[]>([]);
  const runningRef = useRef(false);
  // Bumped by every start and stop. A sweep captures the generation it was
  // launched with, so stopping (on tab blur, say) retires it for good — a later
  // start cannot revive it by flipping runningRef back to true, which would
  // leave two sweeps racing over the same subnet.
  const generationRef = useRef(0);
  const expiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    generationRef.current += 1;
    if (expiryRef.current) {
      clearTimeout(expiryRef.current);
      expiryRef.current = null;
    }
    runningRef.current = false;
    cleanupsRef.current.forEach((cleanup) => {
      try {
        cleanup();
      } catch (error) {
        errorReporter.captureException(error, { context: 'lan-scan-cleanup' });
      }
    });
    cleanupsRef.current = [];
    // 'offline' outlives the scan: the reason we found nothing is still true
    // once the scan window closes, and the screen shows it as a hint.
    setStatus((previous) => (previous === 'offline' ? previous : 'idle'));
  }, []);

  const start = useCallback(async () => {
    if (runningRef.current) return;
    generationRef.current += 1;
    const generation = generationRef.current;
    const live = () => runningRef.current && generation === generationRef.current;
    runningRef.current = true;
    setStatus('scanning');
    deviceRegistry.beginScan('lan');
    expiryRef.current = setTimeout(stop, SCAN_DURATION_MS);
    lanLog('LAN scan starting');

    try {
      cleanupsRef.current.push(runMdnsDiscovery());

      const ssdpDeps = createSsdpDeps();
      if (ssdpDeps) cleanupsRef.current.push(runSsdpDiscovery(ssdpDeps));
      else lanLog('SSDP skipped (react-native-udp not linked)');

      const state = await NetInfo.fetch('wifi');
      // The scan may have been stopped while NetInfo was resolving.
      if (!live()) return;
      const details = state.details as WifiDetails | null;
      const hosts =
        details?.ipAddress && details.subnet
          ? enumerateHosts(details.ipAddress, details.subnet)
          : [];

      // One-shot mDNS interrogation: covers every service type at once and asks
      // each subnet host directly (works on iOS where multicast SSDP is blocked).
      const createMdnsSocket = createMdnsQuerySocket();
      if (createMdnsSocket) {
        cleanupsRef.current.push(runMdnsQuery({ createSocket: createMdnsSocket, hosts }));
      } else {
        lanLog('mDNS one-shot query skipped (react-native-udp not linked)');
      }

      const connect = createTcpConnector();
      if (!connect) {
        lanLog('TCP sweep skipped (react-native-tcp-socket not linked)');
        return;
      }
      if (hosts.length > 0) {
        lanLog(`Wi-Fi ${details?.ipAddress}/${details?.subnet} — sweeping subnet`);
        void sweepHosts(
          hosts,
          connect,
          live,
          createHttpProber(),
          createTcpBannerProber() ?? undefined
        ).catch((error) => {
          errorReporter.captureException(error, { context: 'lan-tcp-sweep' });
        });
      } else if (state.type !== 'wifi') {
        lanLog(`Not on Wi-Fi (connection type: ${state.type}) — TCP sweep skipped`);
        setStatus('offline');
      } else {
        lanLog('On Wi-Fi but NetInfo returned no ipAddress/subnet — TCP sweep skipped');
      }
    } catch (error) {
      if (!live()) return;
      errorReporter.captureException(error, { context: 'lan-scan-start' });
      stop();
      setStatus('error');
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { status, start, stop };
}
