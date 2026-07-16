import { deviceRegistry } from '@/scanner/registry';
import { DNS_TYPE_A, DNS_TYPE_PTR, DNS_TYPE_SRV, DNS_TYPE_TXT } from '@/scanner/lan/dns';
import { QUERY_SERVICE_TYPES, runMdnsQuery, type MdnsSocket } from '@/scanner/lan/mdnsQuery';

jest.mock('@/scanner/registry', () => ({
  deviceRegistry: { report: jest.fn() },
}));

const report = deviceRegistry.report as jest.Mock;

type Sent = { packet: Uint8Array; port: number; address: string };

function fakeSocket(sendError?: (address: string) => Error | undefined) {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const sent: Sent[] = [];
  const socket: MdnsSocket & { sent: Sent[]; emit: (event: string, ...args: unknown[]) => void } = {
    bind: (_port, cb) => cb?.(),
    on: (event, cb) => {
      handlers[event] = cb;
    },
    send: (msg, _offset, _length, port, address, cb) => {
      sent.push({ packet: msg, port, address });
      cb?.(sendError?.(address));
    },
    close: jest.fn(),
    sent,
    emit: (event, ...args) => handlers[event]?.(...args),
  };
  return socket;
}

function nameBytes(name: string): number[] {
  const bytes: number[] = [];
  for (const label of name.split('.')) {
    bytes.push(label.length);
    for (let i = 0; i < label.length; i += 1) bytes.push(label.charCodeAt(i));
  }
  bytes.push(0);
  return bytes;
}

function u16(value: number): number[] {
  return [(value >> 8) & 0xff, value & 0xff];
}

function record(name: number[], type: number, rdata: number[]): number[] {
  return [...name, ...u16(type), ...u16(1), 0, 0, 0, 0, ...u16(rdata.length), ...rdata];
}

function response(records: number[][]): Uint8Array {
  return Uint8Array.from([
    ...u16(0),
    0x84,
    0x00,
    ...u16(0),
    ...u16(records.length),
    ...u16(0),
    ...u16(0),
    ...records.flat(),
  ]);
}

function txtBytes(entries: string[]): number[] {
  return entries.flatMap((entry) => [entry.length, ...entry.split('').map((c) => c.charCodeAt(0))]);
}

beforeEach(() => report.mockClear());

describe('runMdnsQuery', () => {
  it('sends multicast type queries and unicast per-host queries', () => {
    const socket = fakeSocket();
    runMdnsQuery({ createSocket: () => socket, hosts: ['192.168.1.10', '192.168.1.11'] });

    const multicast = socket.sent.filter((s) => s.address === '224.0.0.251');
    expect(multicast.length).toBeGreaterThanOrEqual(Math.ceil(QUERY_SERVICE_TYPES.length / 8));
    expect(multicast.every((s) => s.port === 5353)).toBe(true);
    expect(socket.sent.some((s) => s.address === '192.168.1.10')).toBe(true);
    expect(socket.sent.some((s) => s.address === '192.168.1.11')).toBe(true);
  });

  it('keeps the unicast fan-out alive when the multicast send is blocked (iOS)', () => {
    const socket = fakeSocket((address) =>
      address === '224.0.0.251' ? new Error('EPERM') : undefined
    );
    runMdnsQuery({ createSocket: () => socket, hosts: ['192.168.1.10'] });
    expect(socket.sent.some((s) => s.address === '192.168.1.10')).toBe(true);
  });

  it('reports reverse-PTR hostnames for the IP named in the record', () => {
    const socket = fakeSocket();
    runMdnsQuery({ createSocket: () => socket, hosts: [] });

    socket.emit(
      'message',
      response([
        record(
          nameBytes('10.1.168.192.in-addr.arpa'),
          DNS_TYPE_PTR,
          nameBytes('shellyplug-s-A1B2.local')
        ),
      ]),
      { address: '192.168.1.10' }
    );

    expect(report).toHaveBeenCalledWith({
      id: 'lan:192.168.1.10',
      transport: 'lan',
      signals: { ip: '192.168.1.10', hostname: 'shellyplug-s-A1B2.local' },
    });
  });

  it('follows a service enumeration with per-type queries and reports resolved instances', () => {
    const socket = fakeSocket();
    runMdnsQuery({ createSocket: () => socket, hosts: [] });
    socket.sent.length = 0;

    socket.emit(
      'message',
      response([
        record(
          nameBytes('_services._dns-sd._udp.local'),
          DNS_TYPE_PTR,
          nameBytes('_hue._tcp.local')
        ),
      ]),
      { address: '192.168.1.20' }
    );

    // The enumeration itself already marks the service as advertised…
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'lan:192.168.1.20',
        signals: expect.objectContaining({ mdnsServices: ['_hue._tcp'] }),
      })
    );
    // …and triggers a follow-up PTR query to that host.
    expect(socket.sent.some((s) => s.address === '192.168.1.20' && s.port === 5353)).toBe(true);

    report.mockClear();
    socket.emit(
      'message',
      response([
        record(nameBytes('_hue._tcp.local'), DNS_TYPE_PTR, nameBytes('Hue Bridge._hue._tcp.local')),
        record(nameBytes('Hue Bridge._hue._tcp.local'), DNS_TYPE_SRV, [
          ...u16(0),
          ...u16(0),
          ...u16(443),
          ...nameBytes('philips-hue.local'),
        ]),
        record(nameBytes('Hue Bridge._hue._tcp.local'), DNS_TYPE_TXT, txtBytes(['md=BSB002'])),
        record(nameBytes('philips-hue.local'), DNS_TYPE_A, [192, 168, 1, 20]),
      ]),
      { address: '192.168.1.20' }
    );

    expect(report).toHaveBeenCalledWith({
      id: 'lan:192.168.1.20',
      transport: 'lan',
      signals: {
        ip: '192.168.1.20',
        name: 'Hue Bridge',
        hostname: 'philips-hue.local',
        mdnsServices: ['_hue._tcp'],
        mdnsTxt: { md: 'BSB002' },
      },
    });
  });

  it('does not re-query a type it already asked a host about', () => {
    const socket = fakeSocket();
    runMdnsQuery({ createSocket: () => socket, hosts: [] });
    const enumeration = response([
      record(nameBytes('_services._dns-sd._udp.local'), DNS_TYPE_PTR, nameBytes('_hue._tcp.local')),
    ]);
    socket.emit('message', enumeration, { address: '192.168.1.20' });
    socket.sent.length = 0;
    socket.emit('message', enumeration, { address: '192.168.1.20' });
    expect(socket.sent).toHaveLength(0);
  });

  it('stops sending after cleanup', () => {
    const socket = fakeSocket();
    const cleanup = runMdnsQuery({ createSocket: () => socket, hosts: [] });
    cleanup();
    socket.sent.length = 0;
    socket.emit(
      'message',
      response([
        record(
          nameBytes('_services._dns-sd._udp.local'),
          DNS_TYPE_PTR,
          nameBytes('_hue._tcp.local')
        ),
      ]),
      { address: '192.168.1.20' }
    );
    expect(socket.sent).toHaveLength(0);
    expect(report).not.toHaveBeenCalled();
  });
});
