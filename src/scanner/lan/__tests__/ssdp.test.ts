import { deviceRegistry } from '@/scanner/registry';
import { runSsdpDiscovery, type SsdpDeps } from '@/scanner/lan/ssdp';

jest.mock('@/scanner/registry', () => ({
  deviceRegistry: { report: jest.fn() },
}));

const report = deviceRegistry.report as jest.Mock;

function fakeSocket() {
  const handlers: Record<string, (arg: unknown) => void> = {};
  return {
    on: jest.fn((event: string, cb: (arg: unknown) => void) => {
      handlers[event] = cb;
    }),
    bind: jest.fn((_port: number, cb?: () => void) => cb?.()),
    send: jest.fn(),
    close: jest.fn(),
    emit: (event: string, arg: unknown) => handlers[event]?.(arg),
  };
}

const DESCRIPTION_XML = `<?xml version="1.0"?><root><device>
  <friendlyName>Living Room TV</friendlyName>
  <manufacturer>Acme</manufacturer>
  <modelName>SmartTV 9000</modelName>
</device></root>`;

beforeEach(() => report.mockClear());

describe('runSsdpDiscovery', () => {
  it('resolves a responder LOCATION into a device identity', async () => {
    const socket = fakeSocket();
    const deps: SsdpDeps = {
      createSocket: () => socket,
      fetch: jest.fn(async () => ({ text: async () => DESCRIPTION_XML })),
    };

    runSsdpDiscovery(deps);
    socket.emit(
      'message',
      'HTTP/1.1 200 OK\r\nLOCATION: http://10.0.0.5:8080/desc.xml\r\nST: ssdp:all\r\n\r\n'
    );
    await new Promise((resolve) => setImmediate(resolve));

    expect(deps.fetch).toHaveBeenCalledWith('http://10.0.0.5:8080/desc.xml');
    expect(report).toHaveBeenCalledWith({
      id: 'lan:10.0.0.5',
      transport: 'lan',
      signals: {
        ip: '10.0.0.5',
        ssdp: {
          friendlyName: 'Living Room TV',
          manufacturer: 'Acme',
          modelName: 'SmartTV 9000',
          st: 'ssdp:all',
        },
      },
    });
  });

  it('reports the response headers when the description fetch fails', async () => {
    const socket = fakeSocket();
    runSsdpDiscovery({
      createSocket: () => socket,
      fetch: jest.fn(async () => {
        throw new Error('unreachable');
      }),
    });
    socket.emit(
      'message',
      'HTTP/1.1 200 OK\r\nLOCATION: http://10.0.0.9/desc.xml\r\nSERVER: Synology/DSM/7.1\r\nST: upnp:rootdevice\r\n\r\n'
    );
    await new Promise((resolve) => setImmediate(resolve));

    expect(report).toHaveBeenCalledWith({
      id: 'lan:10.0.0.9',
      transport: 'lan',
      signals: { ip: '10.0.0.9', ssdp: { server: 'Synology/DSM/7.1', st: 'upnp:rootdevice' } },
    });
  });

  it('sends an M-SEARCH when the socket binds', () => {
    const socket = fakeSocket();
    runSsdpDiscovery({
      createSocket: () => socket,
      fetch: jest.fn(async () => ({ text: async () => '' })),
    });
    expect(socket.send).toHaveBeenCalledTimes(1);
    expect(socket.send.mock.calls[0][0]).toContain('M-SEARCH * HTTP/1.1');
  });
});
