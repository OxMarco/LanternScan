// Regenerates src/scanner/fingerprint/haRegistry.generated.ts from Home
// Assistant's hassfest-generated discovery registries (Apache-2.0): mDNS
// service-type + TXT-property rules, SSDP description rules, DHCP hostname
// patterns, and BLE advertisement matchers, each mapping to an integration
// domain. Integration manifests give the human brand name for each domain.
//
//   node scripts/generate-ha-registry.mjs
//
// Commit the regenerated file.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = 'https://raw.githubusercontent.com/home-assistant/core/dev/homeassistant';
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'scanner',
  'fingerprint',
  'haRegistry.generated.ts'
);

async function fetchText(path) {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.text();
}

// The generated registries are Python literals, but hassfest emits them in a
// JSON-compatible style (double quotes throughout); only booleans and trailing
// commas need rewriting.
function pythonLiteralToJson(source, marker) {
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`Marker ${JSON.stringify(marker)} not found.`);
  const literal = source
    .slice(start + marker.length)
    .trim()
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(literal);
}

const [zeroconfSource, ssdpSource, dhcpSource, bluetoothSource] = await Promise.all([
  fetchText('generated/zeroconf.py'),
  fetchText('generated/ssdp.py'),
  fetchText('generated/dhcp.py'),
  fetchText('generated/bluetooth.py'),
]);

const zeroconf = pythonLiteralToJson(zeroconfSource, '\nZEROCONF =');
const ssdp = pythonLiteralToJson(ssdpSource, '\nSSDP =');
const dhcp = pythonLiteralToJson(dhcpSource, '] =');
const bluetooth = pythonLiteralToJson(bluetoothSource, '] =');

// SSDP matcher keys Lantern can actually observe. Rules that also require
// anything else (manufacturerURL, UDN, …) are skipped outright — dropping the
// unmatchable key would loosen the rule and mislabel devices.
const SSDP_KEYS = new Set(['st', 'manufacturer', 'modelName', 'modelDescription', 'deviceType']);

// ---- Collect the domains we need brand names for --------------------------

const domains = new Set();
for (const matchers of Object.values(zeroconf)) {
  for (const matcher of matchers) domains.add(matcher.domain);
}
for (const domain of Object.keys(ssdp)) domains.add(domain);
for (const entry of dhcp) {
  if (typeof entry.hostname === 'string') domains.add(entry.domain);
}
for (const entry of bluetooth) domains.add(entry.domain);

function fallbackName(domain) {
  return domain
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const brandNames = new Map();
const queue = Array.from(domains);
let fetched = 0;
await Promise.all(
  Array.from({ length: 16 }, async () => {
    while (queue.length > 0) {
      const domain = queue.pop();
      try {
        const res = await fetch(`${BASE}/components/${domain}/manifest.json`);
        if (!res.ok) throw new Error(String(res.status));
        const manifest = await res.json();
        brandNames.set(
          domain,
          typeof manifest.name === 'string' ? manifest.name : fallbackName(domain)
        );
        fetched += 1;
      } catch {
        brandNames.set(domain, fallbackName(domain));
      }
    }
  })
);
console.log(`Resolved ${fetched}/${domains.size} brand names from integration manifests.`);

// ---- Zeroconf --------------------------------------------------------------

const zeroconfOut = {};
for (const [rawType, matchers] of Object.entries(zeroconf)) {
  // "_airplay._tcp.local." → "_airplay._tcp"
  const type = rawType.replace(/\.local\.?$/, '');
  const rules = [];
  for (const matcher of matchers) {
    const rule = { brand: brandNames.get(matcher.domain) };
    if (typeof matcher.name === 'string') rule.name = matcher.name;
    if (matcher.properties && typeof matcher.properties === 'object') {
      rule.properties = matcher.properties;
    }
    rules.push(rule);
  }
  if (rules.length > 0) zeroconfOut[type] = rules;
}

// ---- SSDP -------------------------------------------------------------------

const ssdpOut = [];
let ssdpSkipped = 0;
for (const [domain, matchers] of Object.entries(ssdp)) {
  for (const matcher of matchers) {
    const keys = Object.keys(matcher);
    if (keys.length === 0 || !keys.every((key) => SSDP_KEYS.has(key))) {
      ssdpSkipped += 1;
      continue;
    }
    ssdpOut.push({ brand: brandNames.get(domain), match: matcher });
  }
}
console.log(
  `SSDP: kept ${ssdpOut.length} rules, skipped ${ssdpSkipped} needing unobservable keys.`
);

// ---- DHCP hostname patterns -------------------------------------------------

const hostnameOut = [];
const seenPatterns = new Set();
for (const entry of dhcp) {
  if (typeof entry.hostname !== 'string') continue;
  const pattern = entry.hostname.toLowerCase();
  if (seenPatterns.has(pattern)) continue;
  seenPatterns.add(pattern);
  hostnameOut.push([pattern, brandNames.get(entry.domain)]);
}

// ---- Bluetooth advertisement patterns ------------------------------------

const bluetoothOut = [];
for (const entry of bluetooth) {
  const rule = { brand: brandNames.get(entry.domain) };
  if (typeof entry.local_name === 'string') rule.localName = entry.local_name;
  if (typeof entry.manufacturer_id === 'number') rule.manufacturerId = entry.manufacturer_id;
  if (Array.isArray(entry.manufacturer_data_start)) {
    rule.manufacturerDataStart = entry.manufacturer_data_start;
  }
  if (typeof entry.service_uuid === 'string') rule.serviceUuid = entry.service_uuid;
  if (typeof entry.service_data_uuid === 'string') rule.serviceDataUuid = entry.service_data_uuid;

  // `connectable` is a scanner-routing hint in Home Assistant rather than an
  // identity signal. Every other supported key is observable by Lantern.
  if (Object.keys(rule).length > 1) bluetoothOut.push(rule);
}

if (
  Object.keys(zeroconfOut).length < 50 ||
  ssdpOut.length < 40 ||
  hostnameOut.length < 100 ||
  bluetoothOut.length < 100
) {
  throw new Error(
    `Suspiciously small output (${Object.keys(zeroconfOut).length} zeroconf types, ` +
      `${ssdpOut.length} ssdp rules, ${hostnameOut.length} hostnames, ` +
      `${bluetoothOut.length} bluetooth rules) — format likely changed.`
  );
}

const contents = `// AUTO-GENERATED by scripts/generate-ha-registry.mjs — DO NOT EDIT BY HAND.
// Source: home-assistant/core generated discovery registries (Apache-2.0).
// Regenerate with: node scripts/generate-ha-registry.mjs

export type HaZeroconfRule = {
  brand: string;
  // Globs (fnmatch style: * and ?) matched case-insensitively.
  name?: string;
  properties?: Record<string, string>;
};

export type HaBluetoothRule = {
  brand: string;
  localName?: string;
  manufacturerId?: number;
  manufacturerDataStart?: number[];
  serviceUuid?: string;
  serviceDataUuid?: string;
};

// mDNS service type (e.g. "_airplay._tcp") → rules over the instance name and
// TXT-record properties.
export const HA_ZEROCONF: Record<string, HaZeroconfRule[]> = ${JSON.stringify(zeroconfOut, null, 2)};

// Every key in \`match\` must match the corresponding SSDP field (globs allowed).
export const HA_SSDP: { brand: string; match: Record<string, string> }[] = ${JSON.stringify(ssdpOut, null, 2)};

// Hostname glob → brand.
export const HA_HOSTNAMES: [pattern: string, brand: string][] = ${JSON.stringify(hostnameOut, null, 2)};

// Every populated field must match the same BLE advertisement.
export const HA_BLUETOOTH: HaBluetoothRule[] = ${JSON.stringify(bluetoothOut, null, 2)};
`;

writeFileSync(OUT, contents);
console.log(
  `Wrote ${OUT}: ${Object.keys(zeroconfOut).length} zeroconf types, ${ssdpOut.length} ssdp rules, ` +
    `${hostnameOut.length} hostname patterns, ${bluetoothOut.length} bluetooth rules.`
);
