import { requestJson } from '@/lib/apiClient';
import { AppError, normalizeError } from '@/lib/appError';
import type { DeviceGuess, DeviceSignals } from '@/scanner/types';

const INTERROGATE_URL = 'https://api.fingerbank.org/api/v2/combinations/interrogate';

// Fingerbank caps most list inputs at 5 entries per request.
const MAX_LIST = 5;

type FingerbankRequest = {
  mdns_services?: string[];
  mac?: string;
  hostname?: string;
};

// Fingerbank expects fully-qualified mDNS service names (e.g. "_ipp._tcp.local").
// Lantern stores the bare "_ipp._tcp" form, so complete it here.
function qualifyMdns(service: string): string {
  return service.endsWith('.local') ? service : `${service}.local`;
}

// Builds the interrogate payload from the LAN-side signals Fingerbank understands.
// Returns undefined when there is nothing worth asking about — avoids burning a
// request (and leaking a bare MAC) on a device we have no network identity for.
export function buildInterrogateRequest(signals: DeviceSignals): FingerbankRequest | undefined {
  const request: FingerbankRequest = {};

  const services = (signals.mdnsServices ?? []).slice(0, MAX_LIST).map(qualifyMdns);
  if (services.length > 0) request.mdns_services = services;

  if (signals.mac) request.mac = signals.mac;

  const hostname = signals.hostname ?? signals.name;
  if (hostname) request.hostname = hostname;

  // mDNS services are the discriminating signal; a MAC or hostname alone rarely
  // resolves and isn't worth a round trip.
  return request.mdns_services ? request : undefined;
}

// A stable key for a request so we never interrogate the same combination twice.
export function requestSignature(request: FingerbankRequest): string {
  return JSON.stringify({
    mdns: [...(request.mdns_services ?? [])].sort(),
    mac: request.mac ?? '',
    hostname: request.hostname ?? '',
  });
}

type InterrogateResponse = {
  device?: { name?: string } | null;
  manufacturer?: { name?: string } | null;
  operating_system?: { name?: string } | null;
  score?: number | null;
};

// Fingerbank scores run 0–100 over a wide, noisy space; treat it as a soft
// signal by damping it into a confidence that reinforces rather than dominates.
function toConfidence(score: number | null | undefined): number {
  if (typeof score !== 'number' || Number.isNaN(score)) return 0.5;
  const clamped = Math.min(100, Math.max(0, score));
  return Math.round((0.3 + (clamped / 100) * 0.6) * 100) / 100;
}

function toLabel(response: InterrogateResponse): string | undefined {
  const device = response.device?.name?.trim();
  const manufacturer = response.manufacturer?.name?.trim();
  if (device && manufacturer && !device.toLowerCase().includes(manufacturer.toLowerCase())) {
    return `${manufacturer} ${device}`;
  }
  return device || manufacturer || response.operating_system?.name?.trim() || undefined;
}

export function toGuess(
  response: InterrogateResponse
): (DeviceGuess & { os?: string }) | undefined {
  const label = toLabel(response);
  if (!label) return undefined;
  const os = response.operating_system?.name?.trim();
  return {
    label,
    confidence: toConfidence(response.score),
    reason: 'Fingerbank match',
    ...(os ? { os } : {}),
  };
}

type QueryOptions = {
  apiKey: string;
  signal?: AbortSignal;
};

// The four ways an interrogation can end. `no-match` and `failed` both mean "no
// enrichment", but they are not the same event: the first is Fingerbank working
// correctly and telling us it does not recognise the device, the second is
// Fingerbank not answering. Only the second is worth showing the user.
export type FingerbankOutcome =
  | { status: 'skipped' }
  | { status: 'matched'; guess: DeviceGuess & { os?: string } }
  | { status: 'no-match' }
  | { status: 'failed'; error: AppError };

// Turns an AppError into copy that makes sense for Fingerbank specifically. The
// generic AppError user messages assume a signed-in user talking to our own API
// ("Your session has expired") — neither is true here.
export function describeFingerbankError(error: AppError): string {
  switch (error.kind) {
    case 'auth':
    case 'forbidden':
      return 'Fingerbank rejected the API key, so device names cannot be enriched online.';
    case 'rate-limit':
      return 'Fingerbank rate limit reached. Device enrichment has paused for now.';
    case 'network':
    case 'timeout':
      return 'Could not reach Fingerbank. Device names may be less precise.';
    default:
      return 'Fingerbank is unavailable right now. Device names may be less precise.';
  }
}

// Interrogates Fingerbank for a single device. Never throws: every ending is
// reported as an outcome so the caller can tell a genuine failure apart from a
// device Fingerbank simply does not know.
export async function queryFingerbank(
  signals: DeviceSignals,
  { apiKey, signal }: QueryOptions
): Promise<FingerbankOutcome> {
  const request = buildInterrogateRequest(signals);
  if (!request) return { status: 'skipped' };

  try {
    const response = await requestJson<InterrogateResponse>(
      `${INTERROGATE_URL}?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal,
      }
    );
    const guess = toGuess(response);
    return guess ? { status: 'matched', guess } : { status: 'no-match' };
  } catch (error) {
    const appError = normalizeError(error);

    // 404 is how Fingerbank says "I don't know this combination" — an answer, not
    // a failure. `cancelled` is our own abort on unmount, which nobody wants to
    // hear about either.
    if (appError.kind === 'not-found') return { status: 'no-match' };
    if (appError.kind === 'cancelled') return { status: 'skipped' };

    return { status: 'failed', error: appError };
  }
}
