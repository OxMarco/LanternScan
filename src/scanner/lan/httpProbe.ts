import { lanLog } from '@/scanner/lan/debugLog';
import { identifyWebPanel } from '@/scanner/fingerprint/webPanels';
import { deviceRegistry } from '@/scanner/registry';

// Ports worth an HTTP identification probe, in preference order.
const WEB_PORTS = [80, 8080, 443, 8443];
const FETCH_TIMEOUT_MS = 3000;
// Router/NAS/camera admin UIs serve small icons; anything bigger is a web app
// we would not have a fingerprint for anyway.
const MAX_FAVICON_BYTES = 512 * 1024;
const MAX_PANEL_RESPONSE_BYTES = 256 * 1024;
const MAX_PANEL_MATCH_CHARS = 64 * 1024;

type Digest = (data: ArrayBuffer) => Promise<string>;

// expo-crypto is a native module; load lazily so Expo Go/web/jest still work.
function createMd5Digest(): Digest | null {
  try {
    const crypto =
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy load; native module is absent in Expo Go/web/jest
      require('expo-crypto') as typeof import('expo-crypto');
    return async (data) => {
      const hash = await crypto.digest(crypto.CryptoDigestAlgorithm.MD5, data);
      return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join(
        ''
      );
    };
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export type HttpProber = (host: string, openPorts: number[]) => Promise<void>;

// Probes the first open web port for two identification signals: the Server
// response header and the MD5 of /favicon.ico (both matched against bundled
// recog fingerprints). Failures are expected — self-signed HTTPS, no favicon,
// devices that only speak their own protocol — and silently ignored.
export function createHttpProber(): HttpProber {
  const md5 = createMd5Digest();

  return async (host, openPorts) => {
    const port = WEB_PORTS.find((candidate) => openPorts.includes(candidate));
    if (!port) return;
    const scheme = port === 443 || port === 8443 ? 'https' : 'http';
    const base = `${scheme}://${host}:${port}`;

    let server: string | undefined;
    let httpCookies: string[] | undefined;
    let httpWwwAuthenticate: string | undefined;
    let httpPanel: string | undefined;
    try {
      const response = await fetchWithTimeout(`${base}/`, {
        headers: { Range: `bytes=0-${MAX_PANEL_MATCH_CHARS - 1}` },
      });
      server = response.headers.get('server') ?? undefined;
      const cookie = response.headers.get('set-cookie');
      httpCookies = cookie ? [cookie] : undefined;
      httpWwwAuthenticate = response.headers.get('www-authenticate') ?? undefined;
      const contentLength = Number(response.headers.get('content-length'));
      const contentType = response.headers.get('content-type') ?? '';
      if (
        (!Number.isFinite(contentLength) || contentLength <= MAX_PANEL_RESPONSE_BYTES) &&
        (!contentType || /html|text|xml|json/i.test(contentType))
      ) {
        httpPanel = identifyWebPanel((await response.text()).slice(0, MAX_PANEL_MATCH_CHARS));
      }
    } catch {
      return; // port answers TCP but not HTTP — nothing else to try
    }

    let faviconMd5: string | undefined;
    if (md5) {
      try {
        const response = await fetchWithTimeout(`${base}/favicon.ico`);
        if (response.ok) {
          const body = await response.arrayBuffer();
          if (body.byteLength > 0 && body.byteLength <= MAX_FAVICON_BYTES) {
            faviconMd5 = await md5(body);
          }
        }
      } catch {
        // No favicon is the common case.
      }
    }

    if (!server && !faviconMd5 && !httpCookies && !httpWwwAuthenticate && !httpPanel) return;
    lanLog(`HTTP probed ${host}:${port} (server: ${server ?? '—'}, favicon: ${faviconMd5 ?? '—'})`);
    deviceRegistry.report({
      id: `lan:${host}`,
      transport: 'lan',
      signals: {
        ip: host,
        httpServer: server,
        httpCookies,
        httpWwwAuthenticate,
        httpPanel,
        faviconMd5,
      },
    });
  };
}
