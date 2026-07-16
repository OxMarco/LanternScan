import { deviceRegistry } from '@/scanner/registry';
import type { SsdpIdentity } from '@/scanner/types';

import { lanLog } from '@/scanner/lan/debugLog';
import type { WebFetch } from '@/scanner/lan/types';

const SSDP_ADDRESS = '239.255.255.250';
const SSDP_PORT = 1900;
const M_SEARCH = [
  'M-SEARCH * HTTP/1.1',
  `HOST: ${SSDP_ADDRESS}:${SSDP_PORT}`,
  'MAN: "ssdp:discover"',
  'MX: 2',
  'ST: ssdp:all',
  '',
  '',
].join('\r\n');

function parseHeaders(message: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of message.split('\r\n').slice(1)) {
    const index = line.indexOf(':');
    if (index === -1) continue;
    headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
  }
  return headers;
}

function extractTag(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`, 'i'));
  return match?.[1]?.trim();
}

function parseDescription(xml: string): SsdpIdentity {
  return {
    friendlyName: extractTag(xml, 'friendlyName'),
    manufacturer: extractTag(xml, 'manufacturer'),
    modelName: extractTag(xml, 'modelName'),
    modelDescription: extractTag(xml, 'modelDescription'),
    deviceType: extractTag(xml, 'deviceType'),
  };
}

function ipFromLocation(location: string): string | undefined {
  const match = location.match(/^https?:\/\/([^/:]+)/i);
  return match?.[1];
}

export type SsdpDeps = {
  createSocket: () => {
    bind: (port: number, cb?: () => void) => void;
    on: (event: string, cb: (...args: unknown[]) => void) => void;
    send: (
      msg: string,
      offset: number,
      length: number,
      port: number,
      address: string,
      cb?: (error?: Error) => void
    ) => void;
    close: () => void;
  };
  fetch: WebFetch;
};

// Sends an SSDP M-SEARCH and resolves each responder's LOCATION description
// (friendlyName / manufacturer / modelName) into the registry. Returns a
// cleanup function.
export function runSsdpDiscovery(deps: SsdpDeps): () => void {
  const socket = deps.createSocket();
  const seenLocations = new Set<string>();
  let closed = false;

  const handleLocation = async (location: string, headers: Record<string, string>) => {
    if (seenLocations.has(location)) return;
    seenLocations.add(location);
    const ip = ipFromLocation(location);
    if (!ip) return;
    // The response headers alone already identify many devices (recog matches
    // the Server string; Home Assistant rules match ST), so report them even
    // if fetching the description XML below fails.
    const fromHeaders: SsdpIdentity = { server: headers.server, st: headers.st ?? headers.nt };
    try {
      const response = await deps.fetch(location);
      const identity = { ...fromHeaders, ...parseDescription(await response.text()) };
      lanLog(`SSDP resolved ${ip} (${identity.friendlyName ?? identity.modelName ?? 'unknown'})`);
      deviceRegistry.report({ id: `lan:${ip}`, transport: 'lan', signals: { ip, ssdp: identity } });
    } catch {
      // Device advertised but its description is unreachable; keep the headers.
      if (!fromHeaders.server && !fromHeaders.st) return;
      deviceRegistry.report({
        id: `lan:${ip}`,
        transport: 'lan',
        signals: { ip, ssdp: fromHeaders },
      });
    }
  };

  socket.on('message', (msg: unknown) => {
    try {
      const headers = parseHeaders(String(msg));
      if (headers.location) {
        void handleLocation(headers.location, headers).catch((error) => {
          lanLog(`SSDP response ignored: ${String(error)}`);
        });
      }
    } catch (error) {
      lanLog(`SSDP response ignored: ${String(error)}`);
    }
  });
  socket.on('error', (error: unknown) => {
    lanLog(`SSDP socket error: ${String(error)}`);
    if (!closed) {
      try {
        socket.close();
      } catch {
        // Already torn down.
      }
    }
  });

  socket.bind(0, () => {
    try {
      // A send error here is the tell-tale sign of the missing iOS multicast
      // entitlement (sending to 239.255.255.250 is blocked without it).
      socket.send(M_SEARCH, 0, M_SEARCH.length, SSDP_PORT, SSDP_ADDRESS, (error) => {
        if (error) lanLog(`SSDP M-SEARCH send failed: ${String(error)}`);
        else lanLog('SSDP M-SEARCH sent');
      });
    } catch (error) {
      lanLog(`SSDP M-SEARCH could not start: ${String(error)}`);
    }
  });

  return () => {
    closed = true;
    try {
      socket.close();
    } catch {
      // Already closed.
    }
  };
}
