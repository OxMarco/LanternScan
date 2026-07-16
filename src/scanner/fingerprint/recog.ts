import {
  RECOG_DEVICE_INFO,
  RECOG_FAVICONS,
  RECOG_HTTP_COOKIES,
  RECOG_HTTP_SERVERS,
  RECOG_HTTP_WWWAUTH,
  RECOG_SSH_BANNERS,
  type RecogFingerprint,
} from '@/scanner/fingerprint/recog.generated';

// Compile lazily and cache: several hundred patterns ship in the dataset and
// most scans only ever exercise a handful.
const compiledCache = new Map<RecogFingerprint, RegExp | null>();

function compile(fingerprint: RecogFingerprint): RegExp | null {
  let regex = compiledCache.get(fingerprint);
  if (regex === undefined) {
    try {
      regex = new RegExp(fingerprint.p, fingerprint.f);
    } catch {
      regex = null; // engine-specific construct that slipped past codegen
    }
    compiledCache.set(fingerprint, regex);
  }
  return regex;
}

function firstMatch(fingerprints: RecogFingerprint[], value: string): string | undefined {
  for (const fingerprint of fingerprints) {
    if (compile(fingerprint)?.test(value)) return fingerprint.l;
  }
  return undefined;
}

// Recog's device-info fingerprints match individual "key=value" strings of the
// _device-info._tcp TXT record (model=…, osxvers=…). Returns every distinct
// label so an exact hardware match and an OS-version match can both surface.
export function recogDeviceInfoLabels(txt: Record<string, string> | undefined): string[] {
  if (!txt) return [];
  const labels = new Set<string>();
  for (const [key, value] of Object.entries(txt)) {
    const label = firstMatch(RECOG_DEVICE_INFO, `${key}=${value}`);
    if (label) labels.add(label);
  }
  return Array.from(labels);
}

export function recogServerLabel(server: string | undefined): string | undefined {
  return server ? firstMatch(RECOG_HTTP_SERVERS, server) : undefined;
}

export function recogFaviconLabel(md5: string | undefined): string | undefined {
  return md5 ? RECOG_FAVICONS[md5.toLowerCase()] : undefined;
}

export function recogCookieLabels(cookies: string[] | undefined): string[] {
  if (!cookies) return [];
  const labels = new Set<string>();
  for (const cookie of cookies) {
    const label = firstMatch(RECOG_HTTP_COOKIES, cookie);
    if (label) labels.add(label);
  }
  return Array.from(labels);
}

export function recogWwwAuthLabel(value: string | undefined): string | undefined {
  return value ? firstMatch(RECOG_HTTP_WWWAUTH, value) : undefined;
}

export function recogSshBannerLabel(value: string | undefined): string | undefined {
  if (!value) return undefined;
  // Recog's ssh.banner field excludes the RFC 4253 protocol prefix.
  const software = value.trim().replace(/^SSH-[\d.]+-/, '');
  return firstMatch(RECOG_SSH_BANNERS, software);
}
