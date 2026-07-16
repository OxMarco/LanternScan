import { manufacturerPayload } from '@/scanner/ble/manufacturerData';
import {
  HA_BLUETOOTH,
  HA_HOSTNAMES,
  HA_SSDP,
  HA_ZEROCONF,
} from '@/scanner/fingerprint/haRegistry.generated';
import { normalizeServiceUuid } from '@/scanner/fingerprint/serviceUuids';
import type { DeviceSignals, SsdpIdentity } from '@/scanner/types';

// Home Assistant matches discovery rules with Python's fnmatch: case-
// insensitive globs where * spans any run and ? a single character.
const globCache = new Map<string, RegExp>();

export function globMatch(pattern: string, value: string): boolean {
  let regex = globCache.get(pattern);
  if (!regex) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    regex = new RegExp(`^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');
    globCache.set(pattern, regex);
  }
  return regex.test(value);
}

// Service types are case-insensitive on the wire, and the scanners normalize
// them to lowercase; a few registry keys are mixed-case (_Volumio._tcp), so
// index the rules by lowercased type.
const HA_ZEROCONF_BY_TYPE = new Map<string, (typeof HA_ZEROCONF)[string]>();
for (const [type, rules] of Object.entries(HA_ZEROCONF)) {
  const key = type.toLowerCase();
  HA_ZEROCONF_BY_TYPE.set(key, [...(HA_ZEROCONF_BY_TYPE.get(key) ?? []), ...rules]);
}

// mDNS: the rule's service type must have been observed, its name glob (if
// any) must match the instance name, and every property glob must match the
// corresponding TXT value.
export function haZeroconfBrands(signals: DeviceSignals): string[] {
  const brands = new Set<string>();
  for (const service of signals.mdnsServices ?? []) {
    for (const rule of HA_ZEROCONF_BY_TYPE.get(service.toLowerCase()) ?? []) {
      if (rule.name && !(signals.name && globMatch(rule.name, signals.name))) continue;
      let propertiesMatch = true;
      for (const [key, pattern] of Object.entries(rule.properties ?? {})) {
        const value = signals.mdnsTxt?.[key];
        if (!value || !globMatch(pattern, value)) {
          propertiesMatch = false;
          break;
        }
      }
      if (propertiesMatch) brands.add(rule.brand);
    }
  }
  return Array.from(brands);
}

const SSDP_FIELDS: Record<string, keyof SsdpIdentity> = {
  st: 'st',
  manufacturer: 'manufacturer',
  modelName: 'modelName',
  modelDescription: 'modelDescription',
  deviceType: 'deviceType',
};

export function haSsdpBrands(ssdp: SsdpIdentity | undefined): string[] {
  if (!ssdp) return [];
  const brands = new Set<string>();
  for (const rule of HA_SSDP) {
    let matches = true;
    for (const [key, pattern] of Object.entries(rule.match)) {
      const value = ssdp[SSDP_FIELDS[key]];
      if (!value || !globMatch(pattern, value)) {
        matches = false;
        break;
      }
    }
    if (matches) brands.add(rule.brand);
  }
  return Array.from(brands);
}

export function haHostnameBrand(hostname: string | undefined): string | undefined {
  if (!hostname) return undefined;
  // mDNS hostnames come back as "shellyplug-s-1234.local"; the registry
  // patterns cover the bare host part.
  const bare = hostname.replace(/\.local\.?$/i, '');
  for (const [pattern, brand] of HA_HOSTNAMES) {
    if (globMatch(pattern, bare)) return brand;
  }
  return undefined;
}

function startsWithBytes(value: Uint8Array | undefined, prefix: number[]): boolean {
  if (!value || value.length < prefix.length) return false;
  return prefix.every((byte, index) => value[index] === byte);
}

// All populated fields in a rule must agree. This matters for manufacturer IDs
// shared by many unrelated formats, especially Apple's 0x004c allocation.
export function haBluetoothBrands(signals: DeviceSignals): string[] {
  const brands = new Set<string>();
  const advertisedServices = new Set(
    (signals.serviceUUIDs ?? []).map((uuid) => normalizeServiceUuid(uuid))
  );
  const serviceDataUuids = new Set(
    Object.keys(signals.serviceData ?? {}).map((uuid) => normalizeServiceUuid(uuid))
  );
  const payload = manufacturerPayload(signals.manufacturerData);

  for (const rule of HA_BLUETOOTH) {
    if (rule.localName && !(signals.name && globMatch(rule.localName, signals.name))) continue;
    if (
      rule.manufacturerId !== undefined &&
      signals.manufacturerCompanyId !== rule.manufacturerId
    ) {
      continue;
    }
    if (rule.manufacturerDataStart && !startsWithBytes(payload, rule.manufacturerDataStart)) {
      continue;
    }
    if (rule.serviceUuid && !advertisedServices.has(normalizeServiceUuid(rule.serviceUuid))) {
      continue;
    }
    if (rule.serviceDataUuid && !serviceDataUuids.has(normalizeServiceUuid(rule.serviceDataUuid))) {
      continue;
    }
    brands.add(rule.brand);
  }

  return Array.from(brands);
}
