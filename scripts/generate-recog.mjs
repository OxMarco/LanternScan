// Regenerates src/scanner/fingerprint/recog.generated.ts from Rapid7 Recog
// (BSD-2-Clause) fingerprint files:
//   - mdns_device-info_txt.xml — `_device-info._tcp` TXT strings → hardware/OS
//   - http_servers.xml         — HTTP/SSDP Server headers → vendor/product
//   - http_cookies.xml         — Set-Cookie header values → vendor/product
//   - http_wwwauth.xml         — WWW-Authenticate values → vendor/product
//   - ssh_banners.xml          — SSH greeting banners → vendor/product
//   - favicons.xml             — favicon MD5 hashes → product
//
//   node scripts/generate-recog.mjs
//
// Commit the regenerated file.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = 'https://raw.githubusercontent.com/rapid7/recog/main/xml';
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'scanner',
  'fingerprint',
  'recog.generated.ts'
);

function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

// Recog flags → JS RegExp flags. REG_DOT_NEWLINE has an exact JS analogue;
// REG_MULTILINE and REG_ICASE map directly.
const FLAG_MAP = { REG_ICASE: 'i', REG_DOT_NEWLINE: 's', REG_MULTILINE: 'm' };

function parseFingerprints(xml, fileLabel) {
  const fingerprints = [];
  let skipped = 0;
  const blocks = xml.matchAll(/<fingerprint\s([^>]*)>([\s\S]*?)<\/fingerprint>/g);
  for (const [, attributesText, body] of blocks) {
    const attributes = {};
    for (const [, name, value] of attributesText.matchAll(/([\w.]+)="([^"]*)"/g)) {
      attributes[name] = decodeEntities(value);
    }
    if (!attributes.pattern) continue;
    let flags = '';
    for (const flag of (attributes.flags ?? '').split(',')) {
      flags += FLAG_MAP[flag.trim()] ?? '';
    }
    try {
      new RegExp(attributes.pattern, flags);
    } catch {
      skipped += 1;
      continue;
    }
    const description = body.match(/<description>([\s\S]*?)<\/description>/);
    const params = {};
    for (const [, name, value] of body.matchAll(
      /<param\s+pos="0"\s+name="([\w.]+)"\s+value="([^"]*)"/g
    )) {
      params[name] = decodeEntities(value);
    }
    const pair = (vendor, product) =>
      // Avoid "Metabase Metabase" when vendor and product coincide or overlap.
      !vendor || product?.startsWith(vendor)
        ? product
        : [vendor, product].filter(Boolean).join(' ');
    const label =
      pair(params['hw.vendor'], params['hw.product']) ||
      pair(params['os.vendor'], params['os.product']) ||
      pair(params['service.vendor'], params['service.product']) ||
      (description ? decodeEntities(description[1]).replace(/\s+/g, ' ').trim() : '');
    if (!label) {
      skipped += 1;
      continue;
    }
    fingerprints.push({ p: attributes.pattern, ...(flags ? { f: flags } : {}), l: label });
  }
  console.log(`${fileLabel}: ${fingerprints.length} fingerprints (${skipped} skipped).`);
  return fingerprints;
}

async function fetchXml(name) {
  const res = await fetch(`${BASE}/${name}`);
  if (!res.ok) throw new Error(`Failed to fetch ${name}: ${res.status}`);
  return res.text();
}

const [deviceInfoXml, httpServersXml, httpCookiesXml, httpWwwAuthXml, sshBannersXml, faviconsXml] =
  await Promise.all([
    fetchXml('mdns_device-info_txt.xml'),
    fetchXml('http_servers.xml'),
    fetchXml('http_cookies.xml'),
    fetchXml('http_wwwauth.xml'),
    fetchXml('ssh_banners.xml'),
    fetchXml('favicons.xml'),
  ]);

const deviceInfo = parseFingerprints(deviceInfoXml, 'mdns_device-info_txt');
const httpServers = parseFingerprints(httpServersXml, 'http_servers');
const httpCookies = parseFingerprints(httpCookiesXml, 'http_cookies');
const httpWwwAuth = parseFingerprints(httpWwwAuthXml, 'http_wwwauth');
const sshBanners = parseFingerprints(sshBannersXml, 'ssh_banners');

// Favicon patterns are (alternations of) exact MD5 hashes — store them as a
// plain hash → label map instead of regexes.
const favicons = {};
let faviconsSkipped = 0;
for (const { p, l } of parseFingerprints(faviconsXml, 'favicons')) {
  const hashes = p.match(/[0-9a-f]{32}/g);
  const stripped = p.replace(/[0-9a-f]{32}/g, '').replace(/[?:^$()|]/g, '');
  if (!hashes || stripped !== '') {
    faviconsSkipped += 1;
    continue;
  }
  for (const hash of hashes) favicons[hash] = l;
}
if (faviconsSkipped > 0) console.log(`favicons: ${faviconsSkipped} non-literal patterns skipped.`);

if (
  deviceInfo.length < 100 ||
  httpServers.length < 300 ||
  httpCookies.length < 20 ||
  httpWwwAuth.length < 20 ||
  sshBanners.length < 100 ||
  Object.keys(favicons).length < 300
) {
  throw new Error('Suspiciously small output — source format likely changed.');
}

const contents = `// AUTO-GENERATED by scripts/generate-recog.mjs — DO NOT EDIT BY HAND.
// Source: rapid7/recog (BSD-2-Clause). Regenerate with:
// node scripts/generate-recog.mjs

export type RecogFingerprint = {
  // Regex pattern and optional flags, matched via recog.ts.
  p: string;
  f?: string;
  // Human-readable label (vendor + product, or the recog description).
  l: string;
};

// Matched against each "key=value" string of a _device-info._tcp TXT record.
export const RECOG_DEVICE_INFO: RecogFingerprint[] = ${JSON.stringify(deviceInfo)};

// Matched against HTTP and SSDP Server header values.
export const RECOG_HTTP_SERVERS: RecogFingerprint[] = ${JSON.stringify(httpServers)};

// Matched against individual Set-Cookie header values.
export const RECOG_HTTP_COOKIES: RecogFingerprint[] = ${JSON.stringify(httpCookies)};

// Matched against WWW-Authenticate header values.
export const RECOG_HTTP_WWWAUTH: RecogFingerprint[] = ${JSON.stringify(httpWwwAuth)};

// Matched against the first line emitted by an SSH server.
export const RECOG_SSH_BANNERS: RecogFingerprint[] = ${JSON.stringify(sshBanners)};

// MD5 of /favicon.ico → product label.
export const RECOG_FAVICONS: Record<string, string> = ${JSON.stringify(favicons)};
`;

writeFileSync(OUT, contents);
console.log(
  `Wrote ${OUT}: ${deviceInfo.length} device-info, ${httpServers.length} server, ` +
    `${httpCookies.length} cookie, ${httpWwwAuth.length} auth, ${sshBanners.length} SSH, ` +
    `${Object.keys(favicons).length} favicon fingerprints.`
);
