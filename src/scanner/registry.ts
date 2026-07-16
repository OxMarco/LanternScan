import { createPersistedSetting } from '@/lib/persistedSetting';
import { createRssiSmoother, estimateDistanceMeters, type RssiSmoother } from '@/scanner/distance';
import { correctionFor, correctionsSetting } from '@/scanner/fingerprint/corrections';
import type {
  Device,
  DeviceGuess,
  DeviceSignals,
  DeviceSighting,
  Transport,
} from '@/scanner/types';

type SeenMap = Record<string, { firstSeenAt: number }>;

function decodeSeenMap(raw: string | null): SeenMap {
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) return {};
  const result: SeenMap = {};
  for (const [id, record] of Object.entries(parsed)) {
    const firstSeenAt = (record as { firstSeenAt?: unknown })?.firstSeenAt;
    if (typeof firstSeenAt === 'number') result[id] = { firstSeenAt };
  }
  return result;
}

const seenDevicesSetting = createPersistedSetting<SeenMap>(
  'lantern.seenDevices',
  {},
  { decode: decodeSeenMap, encode: JSON.stringify }
);

function unionArrays<T>(a: T[] | undefined, b: T[] | undefined): T[] | undefined {
  if (!a) return b;
  if (!b) return a;
  return Array.from(new Set([...a, ...b]));
}

function mergeSignals(current: DeviceSignals, incoming: DeviceSignals): DeviceSignals {
  return {
    ...current,
    ...Object.fromEntries(Object.entries(incoming).filter(([, value]) => value !== undefined)),
    serviceUUIDs: unionArrays(current.serviceUUIDs, incoming.serviceUUIDs),
    mdnsServices: unionArrays(current.mdnsServices, incoming.mdnsServices),
    openPorts: unionArrays(current.openPorts, incoming.openPorts),
    mdnsTxt: incoming.mdnsTxt ? { ...current.mdnsTxt, ...incoming.mdnsTxt } : current.mdnsTxt,
    serviceData: incoming.serviceData
      ? { ...current.serviceData, ...incoming.serviceData }
      : current.serviceData,
    ssdp: incoming.ssdp ? { ...current.ssdp, ...incoming.ssdp } : current.ssdp,
    gatt: incoming.gatt ? { ...current.gatt, ...incoming.gatt } : current.gatt,
  };
}

const PERSIST_DEBOUNCE_MS = 1000;

// BLE scans with allowDuplicates, so sightings can arrive hundreds of times per
// second. Rebuild the snapshot synchronously (reads stay correct) but coalesce
// the React notifications to a bounded rate so the JS thread stays free to
// handle navigation gestures — otherwise tab switches get dropped mid-scan.
const NOTIFY_THROTTLE_MS = 250;
export const STALE_DEVICE_MS = 5 * 60 * 1000;

function identityTokens(signals: DeviceSignals): Record<string, string> {
  const tokens: Record<string, string> = {};
  const add = (key: string, value: string | undefined) => {
    const normalized = value?.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
    if (normalized) tokens[key] = normalized;
  };
  add('mac', signals.mac);
  add(
    'ssdp',
    [signals.ssdp?.manufacturer, signals.ssdp?.modelName].filter(Boolean).join(' ') || undefined
  );
  add(
    'gatt',
    [signals.gatt?.manufacturer, signals.gatt?.modelNumber].filter(Boolean).join(' ') || undefined
  );
  add('hostname', signals.hostname?.replace(/\.local\.?$/i, ''));
  return tokens;
}

function identityChanged(previous: DeviceSignals, current: DeviceSignals): boolean {
  const before = identityTokens(previous);
  const after = identityTokens(current);
  return Object.keys(before).some((key) => after[key] !== undefined && before[key] !== after[key]);
}

export type DeviceRegistry = {
  hydrate: () => Promise<void>;
  beginScan: (transport: Transport) => void;
  expireStale: (now?: number) => void;
  report: (sighting: DeviceSighting) => void;
  enrich: (id: string, guess: DeviceGuess & { os?: string }) => void;
  forget: (id: string) => void;
  subscribe: (listener: () => void) => () => void;
  getDevices: () => Device[];
  isNew: (id: string) => boolean;
};

export function createDeviceRegistry(): DeviceRegistry {
  const devices = new Map<string, Device>();
  const smoothers = new Map<string, RssiSmoother>();
  const listeners = new Set<() => void>();
  // Devices already persisted before this session started; everything else is "new".
  let knownAtStartup = new Set<string>();
  let hydrated = false;
  let snapshot: Device[] = [];
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  let notifyTimer: ReturnType<typeof setTimeout> | null = null;
  let lastNotifyAt = 0;
  const scanEpoch: Record<Transport, number> = { lan: 0, ble: 0 };
  const deviceEpoch = new Map<string, number>();
  const previousScanSignals = new Map<string, DeviceSignals>();
  const reassignedIds = new Set<string>();

  const emitToListeners = () => {
    lastNotifyAt = Date.now();
    listeners.forEach((listener) => listener());
  };

  const notify = () => {
    // Keep the snapshot current synchronously so getDevices() never lags a report.
    snapshot = Array.from(devices.values());

    // Leading edge: notify right away when we are outside the throttle window,
    // so the first sighting renders immediately.
    const elapsed = Date.now() - lastNotifyAt;
    if (elapsed >= NOTIFY_THROTTLE_MS) {
      if (notifyTimer) {
        clearTimeout(notifyTimer);
        notifyTimer = null;
      }
      emitToListeners();
      return;
    }

    // Trailing edge: coalesce the flood into one notification per window.
    if (notifyTimer) return;
    notifyTimer = setTimeout(() => {
      notifyTimer = null;
      emitToListeners();
    }, NOTIFY_THROTTLE_MS - elapsed);
  };

  const schedulePersist = () => {
    if (persistTimer) return;
    persistTimer = setTimeout(() => {
      persistTimer = null;
      const seen: SeenMap = {};
      for (const device of devices.values()) seen[device.id] = { firstSeenAt: device.firstSeenAt };
      void seenDevicesSetting.read().then((stored) => {
        void seenDevicesSetting.set({ ...stored, ...seen });
      });
    }, PERSIST_DEBOUNCE_MS);
  };

  const expireStale = (now = Date.now()) => {
    let changed = false;
    for (const [id, device] of devices) {
      if (now - device.lastSeenAt <= STALE_DEVICE_MS) continue;
      devices.delete(id);
      smoothers.delete(id);
      deviceEpoch.delete(id);
      previousScanSignals.delete(id);
      changed = true;
    }
    if (changed) notify();
  };

  return {
    async hydrate() {
      const [stored] = await Promise.all([seenDevicesSetting.read(), correctionsSetting.read()]);
      knownAtStartup = new Set(Object.keys(stored));
      hydrated = true;
      for (const device of devices.values()) {
        const userLabel = correctionFor(device.signals);
        if (userLabel) device.signals.userLabel = userLabel;
      }
      if (devices.size > 0) notify();
    },
    beginScan(transport) {
      scanEpoch[transport] += 1;
      expireStale();
    },
    expireStale,
    report(sighting) {
      const now = Date.now();
      const existing = devices.get(sighting.id);
      const epoch = scanEpoch[sighting.transport];
      const enteredNewScan = existing && deviceEpoch.get(sighting.id) !== epoch;
      if (enteredNewScan) previousScanSignals.set(sighting.id, existing.signals);
      const signals =
        existing && !enteredNewScan
          ? mergeSignals(existing.signals, sighting.signals)
          : { ...sighting.signals };
      deviceEpoch.set(sighting.id, epoch);
      if (signals.userLabel === undefined) signals.userLabel = correctionFor(signals);

      const previousSignals = previousScanSignals.get(sighting.id);
      const reassigned = previousSignals ? identityChanged(previousSignals, signals) : false;
      if (reassigned) {
        reassignedIds.add(sighting.id);
        knownAtStartup.delete(sighting.id);
        previousScanSignals.delete(sighting.id);
        smoothers.delete(sighting.id);
        signals.userLabel = correctionFor(signals);
      }

      let distanceMeters = existing?.distanceMeters;
      if (typeof sighting.signals.rssi === 'number') {
        let smoother = smoothers.get(sighting.id);
        if (!smoother) {
          smoother = createRssiSmoother();
          smoothers.set(sighting.id, smoother);
        }
        const smoothedRssi = smoother.next(sighting.signals.rssi);
        signals.rssi = Math.round(smoothedRssi);
        distanceMeters = estimateDistanceMeters(smoothedRssi, signals.txPower);
      }

      const stored = seenDevicesSetting.getCached()?.value;
      const firstSeenAt = reassigned
        ? now
        : (existing?.firstSeenAt ?? stored?.[sighting.id]?.firstSeenAt ?? now);

      devices.set(sighting.id, {
        id: sighting.id,
        transport: sighting.transport,
        signals,
        distanceMeters,
        firstSeenAt,
        lastSeenAt: now,
      });
      schedulePersist();
      notify();
    },
    enrich(id, guess) {
      // Only annotate devices we already know about; enrichment never
      // resurrects a forgotten device or invents a new one.
      const existing = devices.get(id);
      if (!existing) return;
      devices.set(id, {
        ...existing,
        signals: { ...existing.signals, fingerbank: guess },
      });
      notify();
    },
    forget(id) {
      if (devices.delete(id)) {
        smoothers.delete(id);
        deviceEpoch.delete(id);
        previousScanSignals.delete(id);
        reassignedIds.delete(id);
        notify();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getDevices() {
      return snapshot;
    },
    isNew(id) {
      return hydrated && (reassignedIds.has(id) || !knownAtStartup.has(id));
    },
  };
}

export const deviceRegistry = createDeviceRegistry();
