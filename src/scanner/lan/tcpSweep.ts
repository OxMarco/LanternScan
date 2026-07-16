import { lanLog } from '@/scanner/lan/debugLog';
import { deviceRegistry } from '@/scanner/registry';

// Ports that both prove a host is alive and hint at what it is.
const PROBE_PORTS = [80, 443, 8080, 8443, 22, 445, 62078, 9100, 8009, 548, 3389, 5900];
const CONNECT_TIMEOUT_MS = 400;
const MAX_CONCURRENT = 24;

export type TcpConnector = (host: string, port: number, timeoutMs: number) => Promise<boolean>;

// Optional follow-up on hosts with an open web port (HTTP identification probe).
export type WebProber = (host: string, openPorts: number[]) => Promise<void>;
export type BannerProber = (
  host: string,
  port: number,
  timeoutMs: number
) => Promise<string | null>;

async function probeHost(
  host: string,
  connect: TcpConnector,
  shouldContinue: () => boolean,
  probeWeb?: WebProber,
  probeBanner?: BannerProber
): Promise<void> {
  const openPorts: number[] = [];
  for (const port of PROBE_PORTS) {
    // Checked per port, not just per host: a full port list costs seconds, and a
    // stopped scan should let go of the network within one connect timeout.
    if (!shouldContinue()) return;
    if (await connect(host, port, CONNECT_TIMEOUT_MS)) openPorts.push(port);
  }
  if (openPorts.length > 0) {
    lanLog(`TCP host ${host} open ports [${openPorts.join(', ')}]`);
    deviceRegistry.report({
      id: `lan:${host}`,
      transport: 'lan',
      signals: { ip: host, openPorts },
    });
    // Fire and forget so a slow HTTP endpoint never stalls the sweep.
    if (probeWeb) void probeWeb(host, openPorts).catch(() => {});
    if (probeBanner && openPorts.includes(22)) {
      void probeBanner(host, 22, 1200)
        .then((sshBanner) => {
          if (!sshBanner) return;
          deviceRegistry.report({
            id: `lan:${host}`,
            transport: 'lan',
            signals: { ip: host, sshBanner },
          });
        })
        .catch(() => {});
    }
  }
}

// Bounded-concurrency sweep so a /24 does not open hundreds of sockets at once.
export async function sweepHosts(
  hosts: string[],
  connect: TcpConnector,
  shouldContinue: () => boolean = () => true,
  probeWeb?: WebProber,
  probeBanner?: BannerProber
): Promise<void> {
  lanLog(`TCP sweep starting over ${hosts.length} hosts`);
  let cursor = 0;
  const worker = async () => {
    while (cursor < hosts.length && shouldContinue()) {
      const host = hosts[cursor];
      cursor += 1;
      await probeHost(host, connect, shouldContinue, probeWeb, probeBanner);
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT, hosts.length) }, worker));
  lanLog(`TCP sweep finished (${cursor}/${hosts.length} hosts probed)`);
}
