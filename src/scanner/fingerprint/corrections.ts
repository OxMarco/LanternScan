import { createPersistedSetting } from '@/lib/persistedSetting';
import { normalizeServiceUuid } from '@/scanner/fingerprint/serviceUuids';
import type { DeviceSignals } from '@/scanner/types';

type CorrectionMap = Record<string, string>;
type FingerprintRecord = Record<string, unknown>;

function decode(raw: string | null): CorrectionMap {
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return Object.fromEntries(
    Object.entries(parsed).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === 'string' && typeof entry[1] === 'string' && entry[1].trim().length > 0
    )
  );
}

export const correctionsSetting = createPersistedSetting<CorrectionMap>(
  'lantern.fingerprintCorrections.v1',
  {},
  { decode, encode: JSON.stringify }
);

// This signature deliberately excludes IP/MAC addresses, BLE peripheral IDs,
// names, hostnames, serials, raw manufacturer/service payloads and Bonjour TXT
// values. It is useful across devices of the same kind without retaining a
// person's network identity or beacon identifiers.
export function privacySafeFingerprint(signals: DeviceSignals): string {
  const fingerprint = {
    company: signals.manufacturerCompanyId,
    appearance: signals.appearance,
    services: (signals.serviceUUIDs ?? []).map(normalizeServiceUuid).sort(),
    serviceData: Object.keys(signals.serviceData ?? {})
      .map(normalizeServiceUuid)
      .sort(),
    mdns: [...(signals.mdnsServices ?? [])].sort(),
    ports: [...(signals.openPorts ?? [])].sort((a, b) => a - b),
    server: signals.httpServer ?? signals.ssdp?.server,
    panel: signals.httpPanel,
    ssdpManufacturer: signals.ssdp?.manufacturer,
    ssdpModel: signals.ssdp?.modelName,
    ssdpType: signals.ssdp?.deviceType,
    accessPointVendor: signals.apVendor,
    gattManufacturer: signals.gatt?.manufacturer,
    gattModel: signals.gatt?.modelNumber,
  };
  const hasEvidence = Object.values(fingerprint).some((value) =>
    Array.isArray(value) ? value.length > 0 : value !== undefined
  );
  if (!hasEvidence) return '';
  return JSON.stringify(fingerprint);
}

const FIELD_WEIGHTS: Record<string, number> = {
  company: 2,
  appearance: 1.5,
  services: 2,
  serviceData: 2,
  mdns: 2,
  ports: 1,
  server: 3,
  panel: 4,
  ssdpManufacturer: 2,
  ssdpModel: 6,
  ssdpType: 2,
  accessPointVendor: 2,
  gattManufacturer: 2,
  gattModel: 8,
};

const CONFLICTING_IDENTITY_FIELDS = new Set(['ssdpModel', 'gattModel']);
const UNIQUE_IDENTITY_FIELDS = new Set(['ssdpModel', 'gattModel', 'panel']);

function parseFingerprint(value: string): FingerprintRecord | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as FingerprintRecord)
      : undefined;
  } catch {
    return undefined;
  }
}

function normalizedScalar(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  return String(value).replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function arraySimilarity(left: unknown, right: unknown): number | undefined {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length === 0 || right.length === 0) {
    return undefined;
  }
  const a = new Set(left.map(normalizedScalar).filter((value): value is string => Boolean(value)));
  const b = new Set(right.map(normalizedScalar).filter((value): value is string => Boolean(value)));
  if (a.size === 0 || b.size === 0) return undefined;
  const intersection = Array.from(a).filter((value) => b.has(value)).length;
  const union = new Set([...a, ...b]).size;
  return union > 0 ? intersection / union : undefined;
}

// Corrections are learned from an incomplete observation. Later scans can add
// GATT data, ports, or services, so exact JSON equality is too brittle. Compare
// only fields visible in both observations and require either a unique model
// match or agreement across multiple independent dimensions.
export function fingerprintSimilarity(saved: string, current: string): number {
  const a = parseFingerprint(saved);
  const b = parseFingerprint(current);
  if (!a || !b) return 0;

  let matchedWeight = 0;
  let comparedWeight = 0;
  let matchedDimensions = 0;
  let uniqueIdentityMatch = false;

  for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
    const arrayScore = arraySimilarity(a[field], b[field]);
    if (arrayScore !== undefined) {
      comparedWeight += weight;
      matchedWeight += weight * arrayScore;
      if (arrayScore >= 0.5) matchedDimensions += 1;
      continue;
    }

    const left = normalizedScalar(a[field]);
    const right = normalizedScalar(b[field]);
    if (!left || !right) continue;
    comparedWeight += weight;
    if (left === right) {
      matchedWeight += weight;
      matchedDimensions += 1;
      if (UNIQUE_IDENTITY_FIELDS.has(field)) uniqueIdentityMatch = true;
    } else if (CONFLICTING_IDENTITY_FIELDS.has(field)) {
      return 0;
    }
  }

  if (comparedWeight === 0 || (!uniqueIdentityMatch && matchedDimensions < 2)) return 0;
  return matchedWeight / comparedWeight;
}

function closestCorrection(
  corrections: CorrectionMap,
  fingerprint: string
): { key: string; label: string; similarity: number } | undefined {
  let best: { key: string; label: string; similarity: number } | undefined;
  for (const [key, label] of Object.entries(corrections)) {
    const similarity = fingerprintSimilarity(key, fingerprint);
    if (!best || similarity > best.similarity) best = { key, label, similarity };
  }
  return best && best.similarity >= 0.72 ? best : undefined;
}

export function correctionFor(signals: DeviceSignals): string | undefined {
  const fingerprint = privacySafeFingerprint(signals);
  if (!fingerprint) return undefined;
  const corrections = correctionsSetting.getCached()?.value;
  return corrections ? closestCorrection(corrections, fingerprint)?.label : undefined;
}

export async function saveCorrection(signals: DeviceSignals, label: string): Promise<void> {
  const normalized = label.replace(/\s+/g, ' ').trim();
  if (!normalized) return;
  const fingerprint = privacySafeFingerprint(signals);
  if (!fingerprint) return;
  const current = await correctionsSetting.read();
  await correctionsSetting.set({
    ...current,
    [fingerprint]: normalized,
  });
}

export async function removeCorrection(signals: DeviceSignals): Promise<void> {
  const fingerprint = privacySafeFingerprint(signals);
  if (!fingerprint) return;
  const current = await correctionsSetting.read();
  const match = closestCorrection(current, fingerprint);
  if (!match) return;
  const next = { ...current };
  delete next[match.key];
  await correctionsSetting.set(next);
}
