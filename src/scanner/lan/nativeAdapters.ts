import type { MdnsSocket } from '@/scanner/lan/mdnsQuery';
import type { SsdpDeps } from '@/scanner/lan/ssdp';
import type { BannerProber, TcpConnector } from '@/scanner/lan/tcpSweep';

type OptionalModule<T> = T | null;

// Metro requires `require()` to receive a static string literal, so each caller
// passes a thunk that performs the literal require. The try/catch keeps the
// module optional (e.g. absent when running without the native module linked).
function tryRequire<T>(load: () => T): OptionalModule<T> {
  try {
    return load();
  } catch {
    return null;
  }
}

// react-native-tcp-socket: a successful connect means the port is open; any
// error (refused, timeout, unreachable) means closed.
export function createTcpConnector(): TcpConnector | null {
  const tcp = tryRequire<{
    default: {
      createConnection: (
        options: { host: string; port: number; timeout: number },
        callback: () => void
      ) => { on: (event: string, cb: () => void) => void; destroy: () => void };
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
  }>(() => require('react-native-tcp-socket'));
  if (!tcp?.default) return null;

  return (host, port, timeoutMs) =>
    new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (open: boolean) => {
        if (settled) return;
        settled = true;
        try {
          socket.destroy();
        } catch {
          // Ignore double-destroy.
        }
        resolve(open);
      };
      const socket = tcp.default.createConnection({ host, port, timeout: timeoutMs }, () =>
        finish(true)
      );
      socket.on('error', () => finish(false));
      socket.on('timeout', () => finish(false));
    });
}

// Reads only the first greeting line, with a hard byte and time bound. SSH
// servers announce this before authentication, so the probe sends no data and
// makes no login attempt.
export function createTcpBannerProber(): BannerProber | null {
  const tcp = tryRequire<{
    default: {
      createConnection: (
        options: { host: string; port: number; timeout: number },
        callback?: () => void
      ) => {
        on: (event: string, cb: (value?: unknown) => void) => void;
        destroy: () => void;
      };
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
  }>(() => require('react-native-tcp-socket'));
  if (!tcp?.default) return null;

  return (host, port, timeoutMs) =>
    new Promise<string | null>((resolve) => {
      let settled = false;
      let received = '';
      const finish = (value: string | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          socket.destroy();
        } catch {
          // The peer may already have closed the socket.
        }
        resolve(value);
      };
      const socket = tcp.default.createConnection({ host, port, timeout: timeoutMs });
      const timer = setTimeout(() => finish(received.trim() || null), timeoutMs);
      socket.on('data', (value) => {
        received += String(value ?? '').slice(0, 1024 - received.length);
        const lineEnd = received.search(/[\r\n]/);
        if (lineEnd !== -1 || received.length >= 1024) {
          finish(received.slice(0, lineEnd === -1 ? undefined : lineEnd).trim() || null);
        }
      });
      socket.on('error', () => finish(null));
      socket.on('timeout', () => finish(received.trim() || null));
      socket.on('close', () => finish(received.trim() || null));
    });
}

// Same react-native-udp socket as SSDP, but binary: outgoing packets are raw
// DNS bytes and incoming messages arrive as Buffers (a Uint8Array subclass).
export function createMdnsQuerySocket(): (() => MdnsSocket) | null {
  const udp = tryRequire<{ default: { createSocket: (opts: { type: string }) => unknown } }>(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    () => require('react-native-udp')
  );
  if (!udp?.default) return null;
  return () => udp.default.createSocket({ type: 'udp4' }) as MdnsSocket;
}

export function createSsdpDeps(): SsdpDeps | null {
  const udp = tryRequire<{ default: { createSocket: (opts: { type: string }) => unknown } }>(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    () => require('react-native-udp')
  );
  if (!udp?.default || typeof fetch !== 'function') return null;

  return {
    createSocket: () =>
      udp.default.createSocket({ type: 'udp4' }) as ReturnType<SsdpDeps['createSocket']>,
    fetch: (url) => fetch(url).then((response) => ({ text: () => response.text() })),
  };
}
