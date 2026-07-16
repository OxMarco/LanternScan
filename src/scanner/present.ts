import type { FeatherIconName } from '@react-native-vector-icons/feather';

import { guessDevice } from '@/scanner/fingerprint/guess';
import { resolveTrust } from '@/scanner/trustStore';
import type {
  Device,
  DeviceGuess,
  DeviceSignals,
  DeviceType,
  Transport,
  TrustStatus,
} from '@/scanner/types';

type TrustLists = { whitelist: string[]; blacklist: string[] };

export type DeviceCategory = DeviceType | 'unknown';

export type DevicePresentation = {
  id: string;
  transport: Transport;
  category: DeviceCategory;
  title: string;
  // False when the title fell back to "Unknown …" — nothing on the air named it.
  named: boolean;
  subtitle: string;
  trust: TrustStatus;
  lastSeenAt: number;
  distanceMeters?: number;
  distanceLabel?: string;
  signalLabel?: string;
  guesses: DeviceGuess[];
};

// Ordered most- to least-specific: the first keyword found in the device's
// name/hostname/best guesses wins. Anything unmatched stays 'unknown'.
const CATEGORY_KEYWORDS: [keyword: string, category: DeviceCategory][] = [
  ['apple tv', 'tv'],
  ['fire tv', 'tv'],
  ['chromecast', 'tv'],
  ['roku', 'tv'],
  ['google cast', 'tv'],
  ['tv', 'tv'],
  ['playstation', 'console'],
  ['play station', 'console'],
  ['xbox', 'console'],
  ['nintendo', 'console'],
  ['laserjet', 'printer'],
  ['laser jet', 'printer'],
  ['deskjet', 'printer'],
  ['desk jet', 'printer'],
  ['officejet', 'printer'],
  ['office jet', 'printer'],
  ['printer', 'printer'],
  ['fritz!box', 'router'],
  ['fritzbox', 'router'],
  ['fritz box', 'router'],
  ['unifi', 'router'],
  ['eero', 'router'],
  ['airport', 'router'],
  ['access point', 'router'],
  ['router', 'router'],
  // Doorbells before the ring block so "Ring Doorbell" lands on camera.
  ['doorbell', 'camera'],
  ['webcam', 'camera'],
  ['camera', 'camera'],
  ['airtag', 'tracker'],
  ['air tag', 'tracker'],
  ['smarttag', 'tracker'],
  ['smart tag', 'tracker'],
  ['chipolo', 'tracker'],
  // No bare 'tile' here: these keywords substring-match ("FOTILE Kitchenware"
  // is not a Tile). identity.ts handles Tile with a proper word boundary.
  ['hue', 'light'],
  ['lifx', 'light'],
  ['nanoleaf', 'light'],
  ['wled', 'light'],
  ['bulb', 'light'],
  ['lamp', 'light'],
  ['synology', 'nas'],
  ['qnap', 'nas'],
  ['plex', 'computer'],
  ['kodi', 'tv'],
  ['thermometer', 'sensor'],
  ['sensor', 'sensor'],
  ['thermostat', 'thermostat'],
  ['air condition', 'appliance'],
  ['air conditioner', 'appliance'],
  ['purifier', 'appliance'],
  ['vacuum', 'appliance'],
  ['dishwasher', 'appliance'],
  ['washing machine', 'appliance'],
  ['appliance', 'appliance'],
  ['keyboard', 'peripheral'],
  ['mouse', 'peripheral'],
  // Wearables — matched before phone keywords so "Galaxy Watch" / "Galaxy Ring"
  // resolve to the worn form-factor rather than the phone brand.
  ['oura', 'ring'],
  ['smart ring', 'ring'],
  ['galaxy ring', 'ring'],
  ['ring', 'ring'],
  ['apple watch', 'wearable'],
  ['smartwatch', 'wearable'],
  ['watch', 'wearable'],
  ['wristband', 'wearable'],
  ['bracelet', 'wearable'],
  ['fitbit', 'wearable'],
  ['garmin', 'wearable'],
  ['whoop', 'wearable'],
  ['mi band', 'wearable'],
  ['band', 'wearable'],
  ['wearable', 'wearable'],
  ['airpods', 'speaker'],
  ['air pods', 'speaker'],
  ['homepod', 'speaker'],
  ['home pod', 'speaker'],
  ['sonos', 'speaker'],
  ['echo', 'speaker'],
  ['alexa', 'speaker'],
  ['buds', 'speaker'],
  ['earbud', 'speaker'],
  ['headphone', 'speaker'],
  ['headset', 'speaker'],
  ['soundbar', 'speaker'],
  ['speaker', 'speaker'],
  ['iphone', 'phone'],
  ['ipad', 'phone'],
  ['pixel', 'phone'],
  ['galaxy', 'phone'],
  ['android', 'phone'],
  ['phone', 'phone'],
  ['macbook', 'computer'],
  ['imac', 'computer'],
  ['mac mini', 'computer'],
  ['mac', 'computer'],
  ['windows', 'computer'],
  ['chromebook', 'computer'],
  ['thinkpad', 'computer'],
  ['laptop', 'computer'],
  ['desktop', 'computer'],
  ['computer', 'computer'],
  ['nas', 'nas'],
  ['pc', 'computer'],
];

// Compiled with word boundaries: a plain substring check turns "engineering"
// into a ring and "broadband" into a wearable band.
const CATEGORY_MATCHERS: [RegExp, DeviceCategory][] = CATEGORY_KEYWORDS.map(
  ([keyword, category]) => [
    new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    category,
  ]
);

export const CATEGORY_ICON: Record<DeviceCategory, FeatherIconName> = {
  computer: 'monitor',
  phone: 'smartphone',
  speaker: 'speaker',
  tv: 'tv',
  wearable: 'watch',
  ring: 'circle',
  printer: 'printer',
  router: 'wifi',
  camera: 'video',
  tracker: 'map-pin',
  sensor: 'activity',
  light: 'sun',
  thermostat: 'thermometer',
  nas: 'hard-drive',
  console: 'play',
  peripheral: 'type',
  appliance: 'wind',
  unknown: 'help-circle',
};

// Alternating warm tones keep the device list lively: olive for stationary
// gear, tangerine for personal devices, muted for unidentified ones.
type CategoryTone = 'primary' | 'accent' | 'muted';

export const CATEGORY_TONE: Record<DeviceCategory, CategoryTone> = {
  computer: 'primary',
  phone: 'accent',
  speaker: 'primary',
  tv: 'primary',
  wearable: 'accent',
  ring: 'accent',
  printer: 'primary',
  router: 'primary',
  camera: 'primary',
  tracker: 'accent',
  sensor: 'primary',
  light: 'primary',
  thermostat: 'primary',
  nas: 'primary',
  console: 'primary',
  peripheral: 'primary',
  appliance: 'primary',
  unknown: 'muted',
};

export const TONE_BG_CLASS: Record<CategoryTone, string> = {
  primary: 'bg-primary/15',
  accent: 'bg-accent/15',
  muted: 'bg-muted/15',
};

// The guess engine already emits a structured device type per guess
// (identity.ts TYPE_PATTERNS); map those straight onto UI categories so a
// device guessed as a printer never renders as a question mark.
const TYPE_TO_CATEGORY: Record<DeviceType, DeviceCategory> = {
  computer: 'computer',
  phone: 'phone',
  speaker: 'speaker',
  tv: 'tv',
  wearable: 'wearable',
  ring: 'ring',
  printer: 'printer',
  router: 'router',
  camera: 'camera',
  tracker: 'tracker',
  sensor: 'sensor',
  light: 'light',
  thermostat: 'thermostat',
  nas: 'nas',
  console: 'console',
  peripheral: 'peripheral',
  appliance: 'appliance',
};

// Hardware-family identifiers often append a version directly to the family
// name (for example iPhone10,4, iMac21,2, or MacBookPro18,3). Those digits make
// ordinary word-boundary keyword matching fail even though the form factor is
// unambiguous. Keep this independent from the exact marketing-model table so a
// newly released identifier still receives the right icon immediately.
const IPHONE_FAMILY = /iphone/i;
const MAC_FAMILY = /\b(?:mac(?:book(?:pro|air)?|mini|pro)?|imac)(?:\d+,\d+)?\b/i;

function normalizeCategoryText(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/[-_.:,/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function categorizeDevice(signals: DeviceSignals, guesses: DeviceGuess[]): DeviceCategory {
  const typedGuesses = guesses
    .map((guess) => ({ category: guess.type ? TYPE_TO_CATEGORY[guess.type] : undefined, guess }))
    .filter(
      (entry): entry is { category: DeviceCategory; guess: DeviceGuess } =>
        entry.category !== undefined
    );

  // Ground-truth and protocol-level identification should still beat a noisy
  // advertised name. Weaker name-derived guesses are considered only after the
  // explicit family string below, so GalaxyWatch7 cannot inherit Galaxy's phone
  // icon and RingDoorbell2 cannot inherit Ring's jewelry icon.
  const strongGuess = typedGuesses.find(
    ({ guess }) => (guess.categoryConfidence ?? guess.confidence) >= 0.8
  );
  if (strongGuess) return strongGuess.category;

  const identityStrings = [
    signals.name,
    signals.hostname,
    signals.gatt?.name,
    signals.gatt?.manufacturer,
    signals.gatt?.modelNumber,
    signals.ssdp?.friendlyName,
    signals.ssdp?.modelName,
    signals.mdnsTxt?.model,
    ...guesses.map((guess) => guess.label),
  ].filter((value): value is string => Boolean(value));

  if (identityStrings.some((value) => IPHONE_FAMILY.test(value))) return 'phone';
  if (identityStrings.some((value) => MAC_FAMILY.test(value))) return 'computer';

  // Product families are commonly glued to generations and variants:
  // SamsungTV2026, AirConditioner9000, OuraRing4, RingDoorbell2, and so on.
  // Split camel-case and letter/number transitions before applying the shared
  // category vocabulary, leaving the version irrelevant to icon selection.
  const haystack = identityStrings.map(normalizeCategoryText).join(' ');

  for (const [matcher, category] of CATEGORY_MATCHERS) {
    if (matcher.test(haystack)) return category;
  }
  return typedGuesses[0]?.category ?? 'unknown';
}

export const TRUST_COLOR_CLASS: Record<TrustStatus, string> = {
  new: 'text-warning',
  known: 'text-muted',
  whitelisted: 'text-success',
  blacklisted: 'text-error',
};

export const TRUST_DOT_CLASS: Record<TrustStatus, string> = {
  new: 'bg-warning',
  known: 'bg-muted',
  whitelisted: 'bg-success',
  blacklisted: 'bg-error',
};

export const TRUST_LABEL: Record<TrustStatus, string> = {
  new: 'New',
  known: 'Seen before',
  whitelisted: 'Familiar',
  blacklisted: 'Investigate',
};

function distanceLabel(distanceMeters: number | undefined): string | undefined {
  if (distanceMeters === undefined) return undefined;
  if (distanceMeters < 1) return '< 1 m';
  return `~${distanceMeters.toFixed(distanceMeters < 10 ? 1 : 0)} m`;
}

export function presentDevice(
  device: Device,
  lists: TrustLists,
  isNew: boolean
): DevicePresentation {
  const guesses = guessDevice(device.signals);
  const { signals } = device;
  const knownTitle =
    signals.userLabel ??
    signals.name ??
    signals.hostname ??
    signals.ssdp?.friendlyName ??
    guesses[0]?.label ??
    signals.ip;
  const title =
    knownTitle ?? (device.transport === 'ble' ? 'Unknown Bluetooth device' : 'Unknown device');

  // BLE peripherals carry no IP and no usable MAC — mobile OSes hand out a
  // rotating per-app UUID instead — so that identifier takes the address slot.
  const subtitleParts = (
    device.transport === 'ble'
      ? [signals.mac ?? device.id.replace(/^ble:/, '')]
      : [signals.ip, signals.mac]
  ).filter((part): part is string => Boolean(part));

  return {
    id: device.id,
    transport: device.transport,
    category: categorizeDevice(signals, guesses),
    title,
    named: knownTitle !== undefined,
    subtitle: subtitleParts.join('  ·  ') || device.id,
    trust: resolveTrust(device.id, lists, isNew),
    lastSeenAt: device.lastSeenAt,
    distanceMeters: device.distanceMeters,
    distanceLabel: distanceLabel(device.distanceMeters),
    signalLabel: signals.rssi !== undefined ? `${signals.rssi} dBm` : undefined,
    guesses,
  };
}
