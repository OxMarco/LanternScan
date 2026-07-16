// Curated well-known TCP ports → a device-oriented service label. This is the
// useful slice of the IANA service-name registry: the ports whose presence says
// something about what a device *is*, phrased for a person rather than a packet
// (IANA calls 9100 "pdl-datastream"; a human calls it a printer). The TCP sweep
// only probes a small fixed set, so a short hand-maintained table beats bundling
// the full 14k-row registry.
const PORT_SERVICES: Record<number, string> = {
  21: 'FTP',
  22: 'SSH',
  23: 'Telnet',
  25: 'SMTP mail',
  53: 'DNS',
  80: 'HTTP (web)',
  110: 'POP3 mail',
  111: 'RPC',
  135: 'Windows RPC',
  139: 'NetBIOS',
  143: 'IMAP mail',
  161: 'SNMP',
  443: 'HTTPS (web)',
  445: 'SMB file sharing',
  515: 'LPD printer',
  548: 'AFP (Apple file sharing)',
  554: 'RTSP (camera / streaming)',
  631: 'IPP printer',
  993: 'IMAP (TLS)',
  995: 'POP3 (TLS)',
  1883: 'MQTT (IoT)',
  1900: 'SSDP / UPnP',
  3000: 'Web app',
  3306: 'MySQL',
  3389: 'Windows Remote Desktop',
  5000: 'UPnP / web app',
  5060: 'SIP (VoIP)',
  5353: 'mDNS / Bonjour',
  5432: 'PostgreSQL',
  5900: 'VNC screen sharing',
  6379: 'Redis',
  7000: 'AirPlay',
  8008: 'Google Cast',
  8009: 'Google Cast',
  8060: 'Roku',
  8080: 'HTTP (alt web)',
  8443: 'HTTPS (alt web)',
  8883: 'MQTT (TLS)',
  9000: 'Web app',
  9100: 'Raw printing (JetDirect)',
  32400: 'Plex media server',
  49152: 'UPnP',
  62078: 'iPhone / iPad sync',
};

// Renders a port as "9100 (raw printing)" when we recognise it, or the bare
// number otherwise.
export function describePort(port: number): string {
  const service = PORT_SERVICES[port];
  return service ? `${port} (${service})` : String(port);
}

export function describePorts(ports: number[]): string {
  return ports.map(describePort).join(', ');
}
