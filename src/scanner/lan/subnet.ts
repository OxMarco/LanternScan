function ipToInt(ip: string): number | undefined {
  const parts = ip.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return undefined;
  }
  return ((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3];
}

function intToIp(value: number): string {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff].join(
    '.'
  );
}

// The conventional gateway address for the subnet containing `ip`: the first
// usable host (network + 1), where home and office routers almost always live.
// A heuristic, not a guarantee — used only to attach BSSID-derived router
// identity to a likely gateway.
export function gatewayAddress(ip: string, netmask: string): string | undefined {
  const ipInt = ipToInt(ip);
  const maskInt = ipToInt(netmask);
  if (ipInt === undefined || maskInt === undefined) return undefined;
  const network = (ipInt & maskInt) >>> 0;
  return intToIp((network + 1) >>> 0);
}

// Enumerates the usable host addresses on the subnet containing `ip`, skipping
// the network, broadcast, and the device's own address. Caps the count so a
// wide mask (e.g. /16) cannot spawn an unbounded sweep.
export function enumerateHosts(ip: string, netmask: string, maxHosts = 512): string[] {
  const ipInt = ipToInt(ip);
  const maskInt = ipToInt(netmask);
  if (ipInt === undefined || maskInt === undefined) return [];

  const network = (ipInt & maskInt) >>> 0;
  const broadcast = (network | (~maskInt >>> 0)) >>> 0;
  const hosts: string[] = [];
  for (let host = network + 1; host < broadcast && hosts.length < maxHosts; host += 1) {
    if (host === ipInt) continue;
    hosts.push(intToIp(host >>> 0));
  }
  return hosts;
}
