import { deviceRegistry } from '@/scanner/registry';
import { sweepHosts, type TcpConnector } from '@/scanner/lan/tcpSweep';

jest.mock('@/scanner/registry', () => ({
  deviceRegistry: { report: jest.fn() },
}));

const report = deviceRegistry.report as jest.Mock;

beforeEach(() => report.mockClear());

describe('sweepHosts', () => {
  it('reports only hosts with at least one open port', async () => {
    const connect: TcpConnector = jest.fn(async (host, port) => host === '10.0.0.2' && port === 80);
    await sweepHosts(['10.0.0.1', '10.0.0.2'], connect);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'lan:10.0.0.2', signals: { ip: '10.0.0.2', openPorts: [80] } })
    );
  });

  it('stops probing when shouldContinue turns false', async () => {
    const connect: TcpConnector = jest.fn(async () => false);
    await sweepHosts(['10.0.0.1', '10.0.0.2', '10.0.0.3'], connect, () => false);
    expect(connect).not.toHaveBeenCalled();
  });

  it('abandons a host mid-port-list once shouldContinue turns false', async () => {
    let live = true;
    const connect: TcpConnector = jest.fn(async () => {
      live = false; // the user leaves the tab during the very first connect
      return true;
    });
    await sweepHosts(['10.0.0.4'], connect, () => live);

    expect(connect).toHaveBeenCalledTimes(1);
    expect(report).not.toHaveBeenCalled();
  });

  it('captures an SSH banner only after port 22 is found open', async () => {
    const connect: TcpConnector = jest.fn(async (_host, port) => port === 22);
    const banner = jest.fn(async () => 'SSH-2.0-Synology');
    await sweepHosts(['10.0.0.8'], connect, undefined, undefined, banner);
    await Promise.resolve();

    expect(banner).toHaveBeenCalledWith('10.0.0.8', 22, 1200);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ signals: { ip: '10.0.0.8', sshBanner: 'SSH-2.0-Synology' } })
    );
  });
});
