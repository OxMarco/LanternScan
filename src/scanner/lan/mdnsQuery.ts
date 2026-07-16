import { HA_ZEROCONF } from '@/scanner/fingerprint/haRegistry.generated';
import { BROWSED_MDNS_SERVICES } from '@/scanner/fingerprint/mdnsServices';
import { lanLog } from '@/scanner/lan/debugLog';
import {
  DNS_TYPE_PTR,
  decodeDnsRecords,
  encodeDnsQuery,
  ipFromReverseName,
  reverseLookupName,
  type DnsQuestion,
} from '@/scanner/lan/dns';
import { deviceRegistry } from '@/scanner/registry';
import type { DeviceSignals } from '@/scanner/types';

// One-shot mDNS ("legacy unicast", RFC 6762 §6.7): queries sent from an
// ephemeral port get unicast replies, so this needs neither multicast
// reception (blocked on iOS without the restricted entitlement) nor the
// NSBonjourServices allow-list that gates the Bonjour browse APIs. It also
// covers every service type in one shot, where the zeroconf browser can only
// rotate through one type at a time.
const MDNS_ADDRESS = '224.0.0.251';
const MDNS_PORT = 5353;
const SERVICES_ENUM = '_services._dns-sd._udp.local';

// Conservative packet sizing: some responders ignore queries that exceed the
// classic 512-byte DNS payload, and service-type names run ~20 bytes each.
const QUESTIONS_PER_PACKET = 8;
// Unicast fan-out pacing so a /24 doesn't burst hundreds of datagrams at once.
const HOSTS_PER_TICK = 32;
const SEND_TICK_MS = 100;
// Bound per-host follow-ups; no real device advertises more types than this.
const MAX_TYPES_PER_HOST = 24;

// Every service type worth asking about: the curated browse list plus every
// type the Home Assistant discovery rules can label.
export const QUERY_SERVICE_TYPES: string[] = Array.from(
  new Set([...BROWSED_MDNS_SERVICES, ...Object.keys(HA_ZEROCONF)])
);

export type MdnsSocket = {
  bind: (port: number, cb?: () => void) => void;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  send: (
    msg: Uint8Array,
    offset: number,
    length: number,
    port: number,
    address: string,
    cb?: (error?: Error) => void
  ) => void;
  close: () => void;
};

export type MdnsQueryDeps = {
  createSocket: () => MdnsSocket;
  // Unicast fan-out targets (the enumerated subnet); empty means multicast only.
  hosts: string[];
};

// "Living Room._raop._tcp.local" → instance "Living Room", type "_raop._tcp".
// Instance labels may contain dots, hence label-array input.
function parseServiceName(labels: string[]): { instance: string; type: string } | undefined {
  if (labels.length < 3 || labels[labels.length - 1].toLowerCase() !== 'local') return undefined;
  const typeStart = labels.findIndex((label) => label.startsWith('_'));
  if (typeStart <= 0) return undefined;
  const type = labels.slice(typeStart, -1).join('.').toLowerCase();
  if (!/^_[^.]+\._(?:tcp|udp)$/.test(type)) return undefined;
  return { instance: labels.slice(0, typeStart).join('.'), type };
}

// A service-type name like "_hue._tcp.local" (no instance in front).
function parseTypeName(labels: string[]): string | undefined {
  if (labels.length < 3 || labels[labels.length - 1].toLowerCase() !== 'local') return undefined;
  const type = labels.slice(0, -1).join('.').toLowerCase();
  return /^_[^.]+\._(?:tcp|udp)$/.test(type) && !type.startsWith('_services.') ? type : undefined;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

const isIpv4 = (value: unknown): value is string =>
  typeof value === 'string' && /^\d+\.\d+\.\d+\.\d+$/.test(value);

export function runMdnsQuery(deps: MdnsQueryDeps): () => void {
  const socket = deps.createSocket();
  let closed = false;
  let queryId = 1;
  let multicastFailureLogged = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  // Service types already asked (or being asked) per host, so replies cannot
  // trigger the same follow-up twice.
  const queriedTypes = new Map<string, Set<string>>();

  const sendQuery = (questions: DnsQuestion[], address: string) => {
    if (closed || questions.length === 0) return;
    const packet = encodeDnsQuery(queryId, questions);
    queryId = (queryId + 1) & 0xffff;
    socket.send(packet, 0, packet.length, MDNS_PORT, address, (error) => {
      if (error && address === MDNS_ADDRESS && !multicastFailureLogged) {
        multicastFailureLogged = true;
        lanLog(`mDNS multicast query failed (unicast fan-out still runs): ${String(error)}`);
      }
    });
  };

  const followUp = (address: string, types: string[]) => {
    let queried = queriedTypes.get(address);
    if (!queried) {
      queried = new Set();
      queriedTypes.set(address, queried);
    }
    const fresh: DnsQuestion[] = [];
    for (const type of types) {
      if (queried.has(type) || queried.size >= MAX_TYPES_PER_HOST) continue;
      queried.add(type);
      fresh.push({ name: `${type}.local`, type: DNS_TYPE_PTR });
    }
    for (const questions of chunk(fresh, QUESTIONS_PER_PACKET)) sendQuery(questions, address);
  };

  const handleMessage = (...args: unknown[]) => {
    const [msg, rinfo] = args;
    if (closed || !(msg instanceof Uint8Array)) return;
    const sender = (rinfo as { address?: unknown } | undefined)?.address;
    if (!isIpv4(sender)) return;

    // Signals accumulate per device; reverse-PTR answers name the IP inside
    // the record, everything else belongs to the responding host.
    const updates = new Map<string, DeviceSignals>();
    const signalsFor = (ip: string): DeviceSignals => {
      let signals = updates.get(ip);
      if (!signals) {
        signals = { ip, mdnsServices: [] };
        updates.set(ip, signals);
      }
      return signals;
    };
    const advertisedTypes: string[] = [];

    for (const record of decodeDnsRecords(msg)) {
      if (record.type === 'PTR') {
        const reverseIp = ipFromReverseName(record.nameLabels);
        if (reverseIp) {
          signalsFor(reverseIp).hostname = record.targetLabels.filter(Boolean).join('.');
          continue;
        }
        if (record.nameLabels.join('.').toLowerCase() === SERVICES_ENUM) {
          const type = parseTypeName(record.targetLabels);
          if (type) {
            advertisedTypes.push(type);
            signalsFor(sender).mdnsServices?.push(type);
          }
          continue;
        }
        const type = parseTypeName(record.nameLabels);
        const service = parseServiceName(record.targetLabels);
        if (type && service) {
          const signals = signalsFor(sender);
          signals.mdnsServices?.push(type);
          signals.name = service.instance;
        }
      } else if (record.type === 'SRV') {
        const service = parseServiceName(record.nameLabels);
        if (!service) continue;
        const signals = signalsFor(sender);
        signals.mdnsServices?.push(service.type);
        signals.name = service.instance;
        const hostname = record.targetLabels.filter(Boolean).join('.');
        if (hostname) signals.hostname = hostname;
      } else if (record.type === 'TXT') {
        const service = parseServiceName(record.nameLabels);
        if (!service || Object.keys(record.txt).length === 0) continue;
        const signals = signalsFor(sender);
        signals.mdnsServices?.push(service.type);
        signals.mdnsTxt = { ...signals.mdnsTxt, ...record.txt };
      } else if (record.type === 'A') {
        const hostname = record.nameLabels.filter(Boolean).join('.');
        if (hostname.toLowerCase().endsWith('.local'))
          signalsFor(record.address).hostname = hostname;
      }
    }

    for (const [ip, signals] of updates) {
      if (signals.mdnsServices?.length === 0) delete signals.mdnsServices;
      else if (signals.mdnsServices)
        signals.mdnsServices = Array.from(new Set(signals.mdnsServices));
      lanLog(
        `mDNS query reply from ${ip}${signals.mdnsServices ? ` (${signals.mdnsServices.join(', ')})` : ''}`
      );
      deviceRegistry.report({ id: `lan:${ip}`, transport: 'lan', signals });
    }

    // A service-type enumeration tells us what this host offers; ask it for
    // the instances (whose PTR replies carry SRV/TXT/A in the additionals).
    if (advertisedTypes.length > 0) followUp(sender, advertisedTypes);
  };

  socket.on('message', (...args) => {
    try {
      handleMessage(...args);
    } catch (error) {
      // A malformed or surprising packet must not escape a native event
      // callback and take down the JS runtime.
      lanLog(`mDNS response ignored: ${String(error)}`);
    }
  });
  socket.on('error', (error: unknown) => {
    lanLog(`mDNS query socket error: ${String(error)}`);
    if (!closed) {
      closed = true;
      try {
        socket.close();
      } catch {
        // Already torn down.
      }
    }
  });

  socket.bind(0, () => {
    try {
      if (closed) return;
      // Multicast one-shot: reaches every responder at once where the platform
      // allows the send (Android; iOS only with the multicast entitlement).
      const allTypeQuestions: DnsQuestion[] = [
        { name: SERVICES_ENUM, type: DNS_TYPE_PTR },
        ...QUERY_SERVICE_TYPES.map((type) => ({ name: `${type}.local`, type: DNS_TYPE_PTR })),
      ];
      for (const questions of chunk(allTypeQuestions, QUESTIONS_PER_PACKET)) {
        sendQuery(questions, MDNS_ADDRESS);
      }

      // Unicast fan-out: works everywhere. Each host gets asked what services it
      // offers and what its name is; replies drive per-type follow-ups above.
      const pending = [...deps.hosts];
      const sendBatch = () => {
        try {
          for (const host of pending.splice(0, HOSTS_PER_TICK)) {
            sendQuery(
              [
                { name: SERVICES_ENUM, type: DNS_TYPE_PTR },
                { name: reverseLookupName(host), type: DNS_TYPE_PTR },
              ],
              host
            );
          }
          if (pending.length > 0 && !closed) timers.push(setTimeout(sendBatch, SEND_TICK_MS));
        } catch (error) {
          lanLog(`mDNS send stopped: ${String(error)}`);
        }
      };
      sendBatch();
      lanLog(`mDNS one-shot query sent (${deps.hosts.length} unicast targets)`);
    } catch (error) {
      lanLog(`mDNS query could not start: ${String(error)}`);
    }
  });

  return () => {
    closed = true;
    timers.forEach(clearTimeout);
    try {
      socket.close();
    } catch {
      // Already closed.
    }
  };
}
