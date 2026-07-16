export type Transport = 'lan' | 'ble';

export type TrustStatus = 'new' | 'known' | 'whitelisted' | 'blacklisted';

export type DeviceType =
  | 'computer'
  | 'phone'
  | 'speaker'
  | 'tv'
  | 'wearable'
  | 'ring'
  | 'printer'
  | 'router'
  | 'camera'
  | 'tracker'
  | 'sensor'
  | 'light'
  | 'thermostat'
  | 'nas'
  | 'console'
  | 'peripheral'
  | 'appliance';

export type DeviceGuess = {
  label: string;
  confidence: number;
  reason: string;
  vendor?: string;
  family?: string;
  model?: string;
  type?: DeviceType;
  // Confidence is tracked independently at each identity level. A device may
  // be a very certain phone while its exact family or model remains unknown.
  categoryConfidence?: number;
  familyConfidence?: number;
  modelConfidence?: number;
  // Correlated decoders share a source group and count only once in scoring.
  evidenceSources?: string[];
};

// Read directly off a peripheral's Device Information Service (0x180A) and GAP
// Device Name via an active GATT connection — ground-truth strings rather than
// advertised guesses. Populated only after the user taps "Identify".
export type GattDeviceInfo = {
  manufacturer?: string;
  modelNumber?: string;
  serialNumber?: string;
  firmware?: string;
  hardware?: string;
  software?: string;
  name?: string;
};

export type SsdpIdentity = {
  friendlyName?: string;
  manufacturer?: string;
  modelName?: string;
  modelDescription?: string;
  deviceType?: string;
  // From the M-SEARCH response headers rather than the description XML.
  server?: string;
  st?: string;
};

export type DeviceSignals = {
  // A locally saved user correction. Null explicitly clears a prior value.
  userLabel?: string | null;
  name?: string;
  mac?: string;
  ip?: string;
  hostname?: string;
  rssi?: number;
  txPower?: number;
  manufacturerCompanyId?: number;
  // Full manufacturer-specific data (base64, company-ID prefix included) so
  // vendor beacon formats (Microsoft CDP, Apple Find My, …) can be decoded.
  manufacturerData?: string;
  // Advertised service data payloads (base64) keyed by normalized service UUID.
  serviceData?: Record<string, string>;
  // GAP Appearance value (AD type 0x19); Android-only in passive scans.
  appearance?: number;
  serviceUUIDs?: string[];
  mdnsServices?: string[];
  mdnsTxt?: Record<string, string>;
  openPorts?: number[];
  // HTTP probe of an open web port: the Server response header and the MD5 of
  // /favicon.ico, both matched against the bundled recog fingerprints.
  httpServer?: string;
  httpCookies?: string[];
  httpWwwAuthenticate?: string;
  httpPanel?: string;
  faviconMd5?: string;
  // Greeting line emitted by an SSH server before authentication.
  sshBanner?: string;
  ssdp?: SsdpIdentity;
  // Result of an active GATT interrogation (opt-in). Absent until the user taps
  // "Identify" on the detail sheet.
  gatt?: GattDeviceInfo;
  // Vendor of the Wi-Fi access point / router, resolved from the connected
  // network's BSSID OUI. Set on the gateway device by the router identity hook.
  apVendor?: string;
  // Result of an online Fingerbank lookup, merged in asynchronously by the
  // enrichment layer. Absent unless enrichment ran and matched. Carries the
  // resolved operating system alongside the guess so the detail sheet can show
  // it without re-querying.
  fingerbank?: DeviceGuess & { os?: string };
};

export type Device = {
  id: string;
  transport: Transport;
  signals: DeviceSignals;
  distanceMeters?: number;
  firstSeenAt: number;
  lastSeenAt: number;
};

export type DeviceSighting = {
  id: string;
  transport: Transport;
  signals: DeviceSignals;
};
