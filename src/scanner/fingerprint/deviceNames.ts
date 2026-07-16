import type { DeviceGuess, SsdpIdentity } from '@/scanner/types';

type NameRule = {
  pattern: RegExp;
  label: string;
  confidence: number;
};

// Names are useful but user-editable, so these deliberately remain weaker than
// protocol fingerprints and device-information reads. Separators are normalized
// first so common hostnames such as "living-room-chromecast" still match while
// word boundaries avoid accidents such as "pixelated" being classified as a Pixel.
const NAME_RULES: NameRule[] = [
  { pattern: /\bairpods?\b/, label: 'AirPods', confidence: 0.75 },
  { pattern: /\biphone\b/, label: 'iPhone', confidence: 0.65 },
  { pattern: /\bipad\b/, label: 'iPad', confidence: 0.65 },
  { pattern: /\bmacbook(?: pro| air)?\b/, label: 'MacBook', confidence: 0.65 },
  { pattern: /\bimac\b/, label: 'iMac', confidence: 0.65 },
  { pattern: /\bmac mini\b/, label: 'Mac mini', confidence: 0.65 },
  { pattern: /\bapple watch\b/, label: 'Apple Watch', confidence: 0.7 },
  { pattern: /\bhome ?pod\b/, label: 'HomePod', confidence: 0.7 },
  { pattern: /\bapple tv\b/, label: 'Apple TV', confidence: 0.7 },
  { pattern: /\bgalaxy ring\b/, label: 'Samsung Galaxy Ring', confidence: 0.75 },
  { pattern: /\bgalaxy watch\b/, label: 'Samsung Galaxy Watch', confidence: 0.75 },
  {
    pattern: /\b(?:samsung )?galaxy\b|\bsm [a-z]\d{3,4}\b/,
    label: 'Samsung Galaxy',
    confidence: 0.65,
  },
  {
    pattern: /\b(?:google )?pixel(?: \d{1,2}(?: (?:pro|a|xl))?| fold| tablet)?\b/,
    label: 'Google Pixel',
    confidence: 0.65,
  },
  { pattern: /\bchromecast\b/, label: 'Chromecast', confidence: 0.75 },
  { pattern: /\bgoogle home\b/, label: 'Google Home', confidence: 0.7 },
  {
    pattern: /\bnest (?:hub|mini|audio|thermostat|camera|cam|doorbell|protect|wifi)\b/,
    label: 'Google Nest device',
    confidence: 0.65,
  },
  { pattern: /\bplaystation 5\b|\bps ?5\b/, label: 'PlayStation 5', confidence: 0.75 },
  { pattern: /\bplaystation 4\b|\bps ?4\b/, label: 'PlayStation 4', confidence: 0.75 },
  { pattern: /\bplaystation\b/, label: 'PlayStation', confidence: 0.7 },
  { pattern: /\bxbox\b/, label: 'Xbox', confidence: 0.7 },
  { pattern: /\bnintendo switch\b/, label: 'Nintendo Switch', confidence: 0.7 },
  { pattern: /\bsonos\b/, label: 'Sonos speaker', confidence: 0.7 },
  { pattern: /\broku\b/, label: 'Roku streaming player', confidence: 0.7 },
  { pattern: /\b(?:amazon )?echo\b/, label: 'Amazon Echo', confidence: 0.6 },
  { pattern: /\bfire ?tv\b/, label: 'Amazon Fire TV', confidence: 0.7 },
  { pattern: /\bkindle\b/, label: 'Kindle', confidence: 0.6 },
  { pattern: /\broomba\b/, label: 'Roomba vacuum', confidence: 0.7 },
  { pattern: /\bring (?:doorbell|camera|cam)\b/, label: 'Ring camera / doorbell', confidence: 0.7 },
  { pattern: /\barlo\b/, label: 'Arlo camera', confidence: 0.65 },
  { pattern: /\b(?:synology|diskstation)\b/, label: 'Synology NAS', confidence: 0.7 },
  { pattern: /\bqnap\b/, label: 'QNAP NAS', confidence: 0.7 },
  { pattern: /\braspberry pi\b|\braspberrypi\b/, label: 'Raspberry Pi', confidence: 0.7 },
  { pattern: /\bhome ?assistant\b/, label: 'Home Assistant server', confidence: 0.65 },
  {
    pattern: /\b(?:hp|hewlett packard) (?:laser ?jet|office ?jet|desk ?jet|envy)\b/,
    label: 'HP printer',
    confidence: 0.65,
  },
  { pattern: /\bepson\b/, label: 'Epson printer', confidence: 0.55 },
  { pattern: /\bcanon\b/, label: 'Canon printer', confidence: 0.55 },
  { pattern: /\bbrother\b/, label: 'Brother printer', confidence: 0.55 },
  { pattern: /\bprinter\b/, label: 'Printer', confidence: 0.5 },
  {
    pattern: /\b(?:ip )?camera\b|\bwebcam\b|\bdoorbell\b/,
    label: 'Network camera',
    confidence: 0.5,
  },
  { pattern: /\bsmart ?tv\b/, label: 'Smart TV', confidence: 0.5 },
  {
    pattern: /\bair condition(?:er|ing)?\b|\bhvac\b/,
    label: 'Air conditioner',
    confidence: 0.6,
  },
  { pattern: /\bthermostat\b/, label: 'Smart thermostat', confidence: 0.5 },
];

const SSDP_TYPE_RULES: NameRule[] = [
  { pattern: /mediarenderer/i, label: 'Smart TV / streaming player', confidence: 0.65 },
  { pattern: /mediaserver/i, label: 'Media server / NAS', confidence: 0.6 },
  {
    pattern: /internetgatewaydevice|wanconnectiondevice/i,
    label: 'Router / gateway',
    confidence: 0.75,
  },
  { pattern: /wlandevice|accesspoint/i, label: 'Wi-Fi access point', confidence: 0.7 },
  { pattern: /printer/i, label: 'Printer', confidence: 0.75 },
  { pattern: /scanner/i, label: 'Scanner', confidence: 0.7 },
  {
    pattern: /digitalcamera|networkcamera|webcam|doorbell/i,
    label: 'Network camera',
    confidence: 0.7,
  },
  { pattern: /thermostat/i, label: 'Smart thermostat', confidence: 0.65 },
  { pattern: /light|dimmablelamp/i, label: 'Smart light', confidence: 0.6 },
];

function normalizeName(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/[-_.:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function deviceNameHints(values: (string | null | undefined)[]): DeviceGuess[] {
  const matches = new Map<string, DeviceGuess>();

  for (const original of values) {
    if (!original) continue;
    const name = normalizeName(original);
    for (const rule of NAME_RULES) {
      if (!rule.pattern.test(name)) continue;
      const current = matches.get(rule.label);
      if (!current || rule.confidence > current.confidence) {
        matches.set(rule.label, {
          label: rule.label,
          confidence: rule.confidence,
          reason: `Device name contains "${original.trim()}"`,
        });
      }
    }
  }

  return Array.from(matches.values());
}

export function ssdpTypeHints(ssdp: SsdpIdentity | undefined): DeviceGuess[] {
  if (!ssdp) return [];
  const values = [ssdp.deviceType, ssdp.modelDescription].filter((value): value is string =>
    Boolean(value)
  );
  const matches = new Map<string, DeviceGuess>();

  for (const value of values) {
    for (const rule of SSDP_TYPE_RULES) {
      if (!rule.pattern.test(value)) continue;
      matches.set(rule.label, {
        label: rule.label,
        confidence: rule.confidence,
        reason: 'Self-reported UPnP device type',
      });
    }
  }

  return Array.from(matches.values());
}
