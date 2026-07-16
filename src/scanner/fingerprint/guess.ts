import { appearanceName } from '@/scanner/fingerprint/appearance';
import { appleContinuityHints } from '@/scanner/fingerprint/appleContinuity';
import { appleModelName } from '@/scanner/fingerprint/appleModels';
import { decodeBleFormat } from '@/scanner/fingerprint/bleFormats';
import { companyName } from '@/scanner/fingerprint/companyIds';
import { deviceNameHints, ssdpTypeHints } from '@/scanner/fingerprint/deviceNames';
import { decodeFastPairModel } from '@/scanner/fingerprint/fastPair';
import { canonicalIdentityKey, structuredIdentity } from '@/scanner/fingerprint/identity';
import {
  haBluetoothBrands,
  haHostnameBrand,
  haSsdpBrands,
  haZeroconfBrands,
} from '@/scanner/fingerprint/haRegistry';
import { MDNS_SERVICE_HINTS } from '@/scanner/fingerprint/mdnsServices';
import { decodeMsCdpDeviceType } from '@/scanner/fingerprint/msCdp';
import {
  recogCookieLabels,
  recogDeviceInfoLabels,
  recogFaviconLabel,
  recogServerLabel,
  recogSshBannerLabel,
  recogWwwAuthLabel,
} from '@/scanner/fingerprint/recog';
import { serviceDataHint } from '@/scanner/fingerprint/serviceDataHints';
import {
  normalizeServiceUuid,
  serviceDeviceHint,
  serviceName,
} from '@/scanner/fingerprint/serviceUuids';
import {
  SNIFFYPEDIA_UUID16_ORGS,
  SNIFFYPEDIA_UUID16_PRODUCTS,
} from '@/scanner/fingerprint/sniffypedia.generated';
import { detectTracker } from '@/scanner/fingerprint/trackers';
import { theengsDeviceLabels } from '@/scanner/fingerprint/theengs';
import { decodeXiaomiProduct } from '@/scanner/fingerprint/xiaomi';
import type { DeviceGuess, DeviceSignals, DeviceType } from '@/scanner/types';

type Evidence = DeviceGuess & { sourceGroup: string };

const PORT_HINTS: [port: number, label: string, confidence: number][] = [
  [62078, 'iPhone / iPad', 0.8],
  [9100, 'Printer', 0.7],
  [8009, 'Google Cast device (Chromecast / smart speaker)', 0.7],
  [3389, 'Windows PC', 0.7],
  [548, 'Mac', 0.5],
  [5900, 'Computer (screen sharing)', 0.4],
  [445, 'Computer / NAS', 0.35],
  [22, 'Computer (SSH enabled)', 0.3],
  [80, 'Web-enabled device', 0.15],
  [443, 'Web-enabled device', 0.15],
  [8080, 'Web-enabled device', 0.15],
  [8443, 'Web-enabled device', 0.15],
];

function sourceGroupFor(reason: string): string {
  if (reason === 'Identified by you') return 'user';
  if (/device information service/i.test(reason)) return 'gatt';
  if (/Fingerbank/i.test(reason)) return 'fingerbank';
  if (/UPnP/i.test(reason)) return 'ssdp';
  if (/Bonjour|IPP|Matter|Thread border|Advertises _/i.test(reason)) return 'mdns';
  if (/favicon|web interface|web server|web authentication|cookie/i.test(reason)) return 'http';
  if (/SSH banner/i.test(reason)) return 'ssh';
  if (/Port \d+ open/i.test(reason)) return 'ports';
  if (/Device name|Hostname/i.test(reason)) return 'name';
  if (/Wi-Fi access point/i.test(reason)) return 'access-point';
  if (/appearance/i.test(reason)) return 'ble-appearance';
  if (/service UUID|Advertises .* service/i.test(reason)) return 'ble-services';
  if (
    /Bluetooth|beacon|Theengs|advertisement format|Fast Pair|MiBeacon|offline.finding/i.test(reason)
  )
    return 'ble-payload';
  return 'fingerprint';
}

function asEvidence(guess: DeviceGuess): Evidence {
  const inferred = structuredIdentity(guess.label);
  return {
    ...inferred,
    ...guess,
    sourceGroup: sourceGroupFor(guess.reason),
  };
}

function collectEvidence(signals: DeviceSignals): Evidence[] {
  const evidence: DeviceGuess[] = [];

  if (signals.userLabel) {
    evidence.push({ label: signals.userLabel, confidence: 0.995, reason: 'Identified by you' });
  }

  const ssdp = signals.ssdp;
  if (ssdp?.modelName || ssdp?.friendlyName) {
    const label = [ssdp.manufacturer, ssdp.modelName ?? ssdp.friendlyName]
      .filter(Boolean)
      .join(' ');
    evidence.push({ label, confidence: 0.9, reason: 'Self-reported over UPnP' });
  }
  evidence.push(...ssdpTypeHints(ssdp));

  // Ground truth read straight off the device over GATT beats every advertised
  // guess, so it leads with near-certain confidence.
  const gatt = signals.gatt;
  if (gatt?.manufacturer || gatt?.modelNumber) {
    const appleModel = gatt.modelNumber ? appleModelName(gatt.modelNumber) : undefined;
    // Apple exposes hardware identifiers such as "iPhone10,4" through the
    // Device Information Service. Resolve those here as well as in Bonjour so
    // the strongest identity signal produces both a useful name and device type.
    const label = appleModel
      ? `Apple ${appleModel}`
      : [gatt.manufacturer, gatt.modelNumber].filter(Boolean).join(' ');
    evidence.push({
      label,
      confidence: gatt.manufacturer && gatt.modelNumber ? 0.98 : 0.9,
      reason: 'Read from the device information service',
    });
  }

  const mdnsModel = signals.mdnsTxt?.model;
  if (mdnsModel) {
    const marketingName = appleModelName(mdnsModel);
    evidence.push({
      label: marketingName ?? mdnsModel,
      confidence: marketingName ? 0.9 : 0.7,
      reason: `Bonjour device-info model "${mdnsModel}"`,
    });
  }

  // Recog fingerprints over the same TXT record catch what the curated Apple
  // table misses (exact Mac models, macOS versions).
  for (const label of recogDeviceInfoLabels(signals.mdnsTxt)) {
    evidence.push({ label, confidence: 0.85, reason: 'Bonjour device-info fingerprint' });
  }

  // Home Assistant discovery rules: mDNS type + TXT properties, SSDP
  // description fields, and hostname patterns each map to a brand/product.
  for (const brand of haZeroconfBrands(signals)) {
    evidence.push({ label: brand, confidence: 0.65, reason: 'Matches a Bonjour discovery rule' });
  }
  for (const brand of haSsdpBrands(signals.ssdp)) {
    evidence.push({ label: brand, confidence: 0.7, reason: 'Matches a UPnP discovery rule' });
  }
  const hostnameBrand = haHostnameBrand(signals.hostname);
  if (hostnameBrand) {
    evidence.push({
      label: hostnameBrand,
      confidence: 0.6,
      reason: 'Hostname matches a known device pattern',
    });
  }
  for (const brand of haBluetoothBrands(signals)) {
    evidence.push({
      label: brand,
      confidence: 0.72,
      reason: 'Matches a Bluetooth discovery rule',
    });
  }

  // The gateway's Wi-Fi vendor, resolved from its BSSID OUI — the one peer MAC a
  // mobile OS still exposes (see router.ts).
  if (signals.apVendor) {
    evidence.push({
      label: `${signals.apVendor} router`,
      confidence: 0.75,
      reason: 'Wi-Fi access point vendor (BSSID)',
    });
  }

  const serverLabel =
    recogServerLabel(signals.ssdp?.server) ?? recogServerLabel(signals.httpServer);
  if (serverLabel) {
    evidence.push({ label: serverLabel, confidence: 0.7, reason: 'Web server signature' });
  }
  const faviconLabel = recogFaviconLabel(signals.faviconMd5);
  if (faviconLabel) {
    evidence.push({ label: faviconLabel, confidence: 0.75, reason: 'Admin page favicon' });
  }
  if (signals.httpPanel) {
    evidence.push({
      label: signals.httpPanel,
      confidence: 0.82,
      reason: 'Web interface fingerprint',
    });
  }
  for (const label of recogCookieLabels(signals.httpCookies)) {
    evidence.push({ label, confidence: 0.7, reason: 'Web interface cookie signature' });
  }
  const authLabel = recogWwwAuthLabel(signals.httpWwwAuthenticate);
  if (authLabel) {
    evidence.push({ label: authLabel, confidence: 0.75, reason: 'Web authentication signature' });
  }
  const sshLabel = recogSshBannerLabel(signals.sshBanner);
  if (sshLabel) {
    evidence.push({ label: sshLabel, confidence: 0.75, reason: 'SSH banner signature' });
  }

  evidence.push(...deviceNameHints([signals.name, signals.hostname, signals.gatt?.name]));

  const mdnsServices = new Set(signals.mdnsServices ?? []);
  for (const service of mdnsServices) {
    const hint = MDNS_SERVICE_HINTS[service];
    if (hint) {
      evidence.push({ ...hint, reason: `Advertises ${service}` });
    }
  }

  // Printers self-describe in their IPP TXT record: usb_MFG/usb_MDL carry the
  // USB identity strings and ty the marketing name.
  const txt = signals.mdnsTxt;
  const printing = ['_ipp._tcp', '_ipps._tcp', '_printer._tcp', '_pdl-datastream._tcp'].some(
    (service) => mdnsServices.has(service)
  );
  if (printing) {
    const printerLabel = txt?.ty ?? [txt?.usb_MFG, txt?.usb_MDL].filter(Boolean).join(' ');
    if (printerLabel) {
      evidence.push({
        label: printerLabel,
        confidence: 0.9,
        reason: 'Self-reported over IPP',
        type: 'printer',
      });
    }
  }

  // Matter commissionable node: VP is "vendorId+productId" in decimal, DN an
  // optional plaintext device name.
  if (txt?.VP && /^\d+(\+\d+)?$/.test(txt.VP)) {
    evidence.push({
      label: txt.DN ? `${txt.DN} (Matter accessory)` : 'Matter smart-home device',
      confidence: txt.DN ? 0.85 : 0.7,
      reason: `Matter commissioning record (VP ${txt.VP})`,
    });
  }

  // Thread border router: the MeshCoP TXT record names its vendor and model in
  // plaintext (vn/mn).
  if (mdnsServices.has('_meshcop._udp')) {
    const brand = [txt?.vn, txt?.mn].filter(Boolean).join(' ');
    if (brand) {
      evidence.push({
        label: `${brand} (Thread border router)`,
        confidence: 0.85,
        reason: 'Thread border-router record',
      });
    }
  }

  const company = companyName(signals.manufacturerCompanyId);
  if (company) {
    evidence.push({
      label: `${company} device`,
      confidence: 0.45,
      reason: 'Bluetooth manufacturer data',
    });
  }

  // Vendor beacon formats that state outright what the device is.
  const cdpDeviceType = decodeMsCdpDeviceType(
    signals.manufacturerCompanyId,
    signals.manufacturerData
  );
  if (cdpDeviceType) {
    evidence.push({ label: cdpDeviceType, confidence: 0.85, reason: 'Microsoft CDP beacon' });
  }
  evidence.push(...appleContinuityHints(signals));
  const fastPairModel = decodeFastPairModel(signals.serviceData);
  if (fastPairModel) {
    evidence.push({ label: fastPairModel, confidence: 0.85, reason: 'Google Fast Pair model ID' });
  }
  const xiaomiProduct = decodeXiaomiProduct(signals.serviceData);
  if (xiaomiProduct) {
    evidence.push({ label: xiaomiProduct, confidence: 0.9, reason: 'Xiaomi MiBeacon product ID' });
  }
  const tracker = detectTracker(signals);
  if (tracker) {
    evidence.push({ label: tracker.label, confidence: 0.85, reason: tracker.reason });
  }
  const bleFormat = decodeBleFormat(signals);
  if (bleFormat) {
    evidence.push({
      label: bleFormat,
      confidence: 0.85,
      reason: 'Recognized BLE advertisement format',
    });
  }
  for (const label of theengsDeviceLabels(signals)) {
    evidence.push({
      label,
      // Theengs is broad and excellent as a fallback, but several of its
      // family labels intentionally overlap Lantern's narrower protocol
      // decoders (AirTag, MS-CDP, Tile, exact local-name models). Keep those
      // deterministic product decoders ahead when both match.
      confidence: 0.68,
      reason: 'Theengs BLE payload fingerprint',
    });
  }

  const appearance = appearanceName(signals.appearance);
  if (appearance) {
    evidence.push({
      label: appearance,
      confidence: 0.6,
      reason: 'Advertised Bluetooth appearance',
    });
  }

  // Service UUIDs can betray the product line (Sniffypedia) or the device
  // class (curated GATT hints); check both the advertised list and the
  // service-data keys, since many devices only populate one of the two.
  const seenUuids = new Set<string>();
  for (const uuid of [...(signals.serviceUUIDs ?? []), ...Object.keys(signals.serviceData ?? {})]) {
    const normalized = normalizeServiceUuid(uuid);
    if (seenUuids.has(normalized)) continue;
    seenUuids.add(normalized);

    const hint = serviceDeviceHint(normalized);
    if (hint) {
      const named = serviceName(normalized);
      evidence.push({
        label: hint.label,
        confidence: hint.confidence,
        reason: named ? `Advertises ${named} service` : `Advertises BLE service ${normalized}`,
      });
    }

    const product = SNIFFYPEDIA_UUID16_PRODUCTS[normalized];
    if (product) {
      evidence.push({
        label: product,
        confidence: 0.7,
        reason: `Advertises the ${product} service UUID`,
      });
    } else {
      const org = SNIFFYPEDIA_UUID16_ORGS[normalized];
      if (org) {
        evidence.push({
          label: `${org} device`,
          confidence: 0.4,
          reason: 'Advertises a vendor-registered service UUID',
        });
      }
    }
  }

  for (const [uuid, payload] of Object.entries(signals.serviceData ?? {})) {
    const dataHint = serviceDataHint(normalizeServiceUuid(uuid), payload);
    if (dataHint) evidence.push(dataHint);
  }

  // Online enrichment: fold a Fingerbank match in as one more independent signal
  // so it reinforces (rather than overrides) agreeing offline evidence.
  if (signals.fingerbank) {
    evidence.push(signals.fingerbank);
  }

  for (const port of signals.openPorts ?? []) {
    const hint = PORT_HINTS.find(([hintPort]) => hintPort === port);
    if (hint) {
      evidence.push({ label: hint[1], confidence: hint[2], reason: `Port ${port} open` });
    }
  }

  return evidence.map(asEvidence);
}

function normalized(value: string | undefined): string | undefined {
  return value?.replace(/\s+/g, ' ').trim().toLocaleLowerCase() || undefined;
}

function combineBySource(evidence: Evidence[]): { confidence: number; sources: string[] } {
  const strongest = new Map<string, number>();
  for (const item of evidence) {
    strongest.set(
      item.sourceGroup,
      Math.max(strongest.get(item.sourceGroup) ?? 0, item.confidence)
    );
  }
  const confidence =
    1 - Array.from(strongest.values()).reduce((failure, value) => failure * (1 - value), 1);
  return { confidence, sources: Array.from(strongest.keys()).sort() };
}

function identitiesAgree(candidate: Evidence, item: Evidence): boolean {
  if (canonicalIdentityKey(candidate.label) === canonicalIdentityKey(item.label)) return true;
  if (candidate.type && item.type && candidate.type !== item.type) return false;
  if (candidate.vendor && item.vendor && normalized(candidate.vendor) !== normalized(item.vendor)) {
    return false;
  }
  if (candidate.family && item.family) {
    if (normalized(candidate.family) !== normalized(item.family)) return false;
    if (candidate.model && item.model && normalized(candidate.model) !== normalized(item.model)) {
      return false;
    }
    return true;
  }
  return Boolean(
    candidate.model && item.model && normalized(candidate.model) === normalized(item.model)
  );
}

function adjustedForConflict(score: number, opposition: number): number {
  // Strong ground truth barely moves in the face of a weak contradictory name,
  // while a weak guess is substantially discounted by stronger opposition.
  return score * (1 - opposition * (1 - score));
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

export function guessDevice(signals: DeviceSignals, limit = 3): DeviceGuess[] {
  const evidence = collectEvidence(signals);
  const candidates = new Map<string, Evidence>();
  for (const item of evidence) {
    const key = canonicalIdentityKey(item.label);
    const existing = candidates.get(key);
    const specificity = item.label.split(/\s+/).length + (/[\d()]/.test(item.label) ? 2 : 0);
    const existingSpecificity = existing
      ? existing.label.split(/\s+/).length + (/[\d()]/.test(existing.label) ? 2 : 0)
      : -1;
    if (!existing || specificity > existingSpecificity) candidates.set(key, item);
  }

  const categoryEvidence = new Map<DeviceType, Evidence[]>();
  for (const item of evidence) {
    if (!item.type) continue;
    const items = categoryEvidence.get(item.type) ?? [];
    items.push(item);
    categoryEvidence.set(item.type, items);
  }
  const categoryScores = Array.from(categoryEvidence, ([type, items]) => ({
    type,
    score: combineBySource(items).confidence,
  })).sort((a, b) => b.score - a.score);

  return Array.from(candidates.values())
    .map((candidate) => {
      const supporting = evidence.filter((item) => identitiesAgree(candidate, item));
      const identity = combineBySource(supporting);
      const dominantType = candidate.type ?? categoryScores[0]?.type;
      const rawCategoryScore =
        categoryScores.find(({ type }) => type === dominantType)?.score ?? candidate.confidence;
      const categoryOpposition =
        categoryScores.find(({ type }) => type !== dominantType)?.score ?? 0;
      const categoryConfidence = adjustedForConflict(rawCategoryScore, categoryOpposition);
      const identityConfidence = candidate.type
        ? adjustedForConflict(identity.confidence, categoryOpposition)
        : identity.confidence;
      const familyEvidence = candidate.family
        ? evidence.filter(
            (item) =>
              normalized(item.family) === normalized(candidate.family) &&
              (!candidate.type || !item.type || candidate.type === item.type)
          )
        : [];
      const modelEvidence = candidate.model
        ? evidence.filter((item) => normalized(item.model) === normalized(candidate.model))
        : [];
      const specificity =
        candidate.label.split(/\s+/).length + (/[\d()]/.test(candidate.label) ? 2 : 0);
      const modelConfidence = modelEvidence.length
        ? combineBySource(modelEvidence).confidence
        : undefined;
      const familyConfidence = familyEvidence.length
        ? combineBySource(familyEvidence).confidence
        : undefined;
      return {
        label: candidate.label,
        confidence: rounded(identityConfidence),
        reason: supporting
          .map((item) => item.reason)
          .filter((reason, index, reasons) => reasons.indexOf(reason) === index)
          .join(' · '),
        ...(candidate.vendor ? { vendor: candidate.vendor } : {}),
        ...(candidate.family ? { family: candidate.family } : {}),
        ...(candidate.model ? { model: candidate.model } : {}),
        ...(dominantType ? { type: dominantType } : {}),
        ...(dominantType ? { categoryConfidence: rounded(categoryConfidence) } : {}),
        ...(familyConfidence !== undefined ? { familyConfidence: rounded(familyConfidence) } : {}),
        ...(modelConfidence !== undefined ? { modelConfidence: rounded(modelConfidence) } : {}),
        evidenceSources: identity.sources,
        rank:
          identityConfidence +
          (modelConfidence !== undefined
            ? /[\d()]/.test(candidate.model ?? '')
              ? 0.15
              : 0.08
            : familyConfidence !== undefined
              ? 0.04
              : 0) +
          specificity / 10_000,
      };
    })
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit)
    .map(({ rank: _rank, ...guess }) => guess);
}
