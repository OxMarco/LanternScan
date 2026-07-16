// A deliberately small, passive-only subset of product-identification ideas
// from ProjectDiscovery's MIT-licensed nuclei-templates. Lantern performs one
// bounded GET and matches returned title/body text; no login, CVE, or exploit
// templates are included.
const PANEL_PATTERNS: [RegExp, string][] = [
  [/\bSynology (?:DiskStation|DSM)\b/i, 'Synology DiskStation'],
  [/\bQNAP (?:Turbo NAS|QTS|QuTS)\b/i, 'QNAP NAS'],
  [/\bUniFi (?:Network|OS|Controller)\b/i, 'Ubiquiti UniFi'],
  [/\bHome Assistant\b/i, 'Home Assistant'],
  [/\bpfSense\b/i, 'Netgate pfSense router'],
  [/\bLuCI[^<]{0,80}OpenWrt|OpenWrt[^<]{0,80}LuCI\b/i, 'OpenWrt router'],
  [/\bHikvision\b|doc\/page\/login\.asp/i, 'Hikvision camera'],
  [/\bReolink\b/i, 'Reolink camera'],
  [/\bESPHome\b/i, 'ESPHome device'],
  [/\bPi-hole\b/i, 'Pi-hole'],
  [/\bTrueNAS\b/i, 'TrueNAS server'],
  [/\bProxmox Virtual Environment\b/i, 'Proxmox server'],
  [/\bJellyfin\b/i, 'Jellyfin media server'],
  [/\bPlex Web\b/i, 'Plex media server'],
  [/\bOctoPrint\b/i, 'OctoPrint 3D printer server'],
  [/\bBrother Web Based Management\b/i, 'Brother printer'],
  [/\bHP (?:Embedded Web Server|Device Toolbox)\b/i, 'HP printer'],
];

export function identifyWebPanel(value: string): string | undefined {
  return PANEL_PATTERNS.find(([pattern]) => pattern.test(value))?.[1];
}
