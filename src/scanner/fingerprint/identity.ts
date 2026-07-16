import type { DeviceGuess, DeviceType } from '@/scanner/types';

const VENDORS = [
  'Apple',
  'Samsung',
  'Google',
  'Microsoft',
  'Amazon',
  'Sony',
  'Nintendo',
  'Sonos',
  'Xiaomi',
  'Garmin',
  'Fitbit',
  'Roku',
  'Synology',
  'QNAP',
  'HP',
  'Epson',
  'Canon',
  'Brother',
  'Cisco',
  'Ubiquiti',
  'Netgear',
  'TP-Link',
  'Ring',
  'Arlo',
  'Raspberry Pi',
];

const FAMILY_PATTERNS: [RegExp, string][] = [
  [/\bairpods\b/i, 'AirPods'],
  [/\biphone\b/i, 'iPhone'],
  [/\bipad\b/i, 'iPad'],
  [/\bmacbook(?: pro| air)?\b/i, 'MacBook'],
  [/\bapple watch\b/i, 'Apple Watch'],
  [/\bapple tv\b/i, 'Apple TV'],
  [/\bgalaxy\b/i, 'Galaxy'],
  [/\bpixel\b/i, 'Pixel'],
  [/\bchromecast|google cast\b/i, 'Google Cast'],
  [/\bplaystation\b/i, 'PlayStation'],
  [/\bxbox\b/i, 'Xbox'],
  [/\bkindle\b/i, 'Kindle'],
  [/\bfire tv\b/i, 'Fire TV'],
  [/\broku\b/i, 'Roku'],
  [/\bring\b/i, 'Ring'],
];

const TYPE_PATTERNS: [RegExp, DeviceType][] = [
  [/\bprinter|scanner\b/i, 'printer'],
  [/\brouter|gateway|access point|base station|coordinator\b/i, 'router'],
  [/\bcamera|doorbell\b/i, 'camera'],
  [
    /\bspeaker|airpods|beats|headphone|headset|earbud|soundbar|buds|audio|acoustics?|hearing\b/i,
    'speaker',
  ],
  [
    /\bair[- ]?condition|hvac|air purifier|vacuum|dishwasher|washing machine|refrigerator|appliance\b/i,
    'appliance',
  ],
  [/\b(?:smart ring|galaxy ring|oura ring)\b/i, 'ring'],
  [/\b(?:smartwatch|watch|wristband|wearable)\b/i, 'wearable'],
  [/\bkeyboard|mouse|trackpad\b/i, 'peripheral'],
  [/\b(?:phones?|iphone|pixel|galaxy)\b/i, 'phone'],
  [/\bplaystation|xbox|nintendo\b/i, 'console'],
  [/\b(?:tv|chromecast|roku)\b/i, 'tv'],
  [/\bnas\b/i, 'nas'],
  [/\bcomputer|laptop|desktop|macbook|windows pc\b/i, 'computer'],
  [/\btracker|airtag|smarttag|chipolo|\btile\b/i, 'tracker'],
  [/\bsensor|thermometer|hygrometer|energy meter|energy monitor\b/i, 'sensor'],
  [/\bstreaming player|media renderer|media player\b/i, 'tv'],
  [/\bthermostat\b/i, 'thermostat'],
  [/\b(?:smart light|lighting|lamp|bulb|hue|lifx|nanoleaf|wled)\b/i, 'light'],
  [/\bserver|raspberry pi\b/i, 'computer'],
];

// Single-vertical vendors whose name alone reveals the form factor — e.g. the
// SIG company-ID table yields labels like "Oura Health Oy device" or "GD Midea
// Air-Conditioning Equipment Co., Ltd. device" that carry no product word.
// Checked only after TYPE_PATTERNS so an explicit product word always wins.
// Conglomerates (Sony, Samsung, Xiaomi, LG…) stay out: their name proves nothing.
//
// Matches are deliberately loose substrings: within the bundled company table,
// anything containing "fit" is fitness gear ("Misfit Wearables", "shenzhen
// fitcare", "Wahoo Fitness"). Word boundaries survive only where the table
// proves collisions: tile (FOTILE, Tactile), polar (Polaris), zepp (Zeppelin),
// gree (Ugreen, Pedigree, Green*), plus the short/name-like arlo, jbl, polk, tado.
const VENDOR_TYPE_PATTERNS: [RegExp, DeviceType][] = [
  [/oura/i, 'ring'],
  [/fit|whoop|\bzepp\b|garmin|suunto|\bpolar\b/i, 'wearable'],
  [/\btile\b|chipolo|pebblebee/i, 'tracker'],
  [/sonos|bose|\bjbl\b|jlab|sennheiser|jabra|klipsch|harman|\bpolk\b/i, 'speaker'],
  [/signify|lifx|govee|yeelight/i, 'light'],
  [/midea|daikin|dyson|irobot|roborock|gree electric/i, 'appliance'],
  [/ecobee|\btado\b/i, 'thermostat'],
  [/logitech/i, 'peripheral'],
  [/\barlo\b|reolink|hikvision|dahua/i, 'camera'],
  [/netgear|tp-?link|ubiquiti/i, 'router'],
];

const CANONICAL_ALIASES: [RegExp, string][] = [
  [/^(?:chromecast|google cast device(?: \(chromecast \/ smart speaker\))?)$/i, 'Google Cast'],
  // Continuity beacons and the SIG company-ID table describe the same sighting;
  // fold them so the two low-confidence signals reinforce instead of compete.
  [/^apple(?:, inc\.?)? device(?: \(airdrop active\))?$/i, 'Apple device'],
  [/^(?:mac|apple mac)$/i, 'Mac'],
  [/^computer \(ssh enabled\)$/i, 'Computer'],
  [/^computer \(screen sharing\)$/i, 'Computer'],
  [/^web-enabled device$/i, 'Web device'],
];

export function canonicalIdentityKey(label: string): string {
  const trimmed = label.replace(/\s+/g, ' ').trim();
  const alias = CANONICAL_ALIASES.find(([pattern]) => pattern.test(trimmed));
  return (alias?.[1] ?? trimmed).toLocaleLowerCase();
}

export function structuredIdentity(
  label: string
): Pick<DeviceGuess, 'vendor' | 'family' | 'model' | 'type'> {
  const vendor = VENDORS.find((candidate) =>
    new RegExp(`\\b${candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(label)
  );
  const family = FAMILY_PATTERNS.find(([pattern]) => pattern.test(label))?.[1];
  const type =
    TYPE_PATTERNS.find(([pattern]) => pattern.test(label))?.[1] ??
    VENDOR_TYPE_PATTERNS.find(([pattern]) => pattern.test(label))?.[1];
  const withoutVendor = vendor
    ? label.replace(new RegExp(`^${vendor}\\s+`, 'i'), '').trim()
    : label.trim();
  const genericModel = /^(?:device|router|gateway|computer|phone|speaker|tv|wearable)$/i.test(
    withoutVendor
  );
  const model =
    !genericModel &&
    ((vendor && withoutVendor !== label) ||
      (family && withoutVendor.toLocaleLowerCase() !== family.toLocaleLowerCase()))
      ? withoutVendor
      : undefined;
  return {
    ...(vendor ? { vendor } : {}),
    ...(family ? { family } : {}),
    ...(model ? { model } : {}),
    ...(type ? { type } : {}),
  };
}
