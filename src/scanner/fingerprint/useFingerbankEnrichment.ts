import { useCallback, useEffect, useRef, useState } from 'react';

import { useDevices } from '@/hooks/useDevices';
import { useIsOnline } from '@/hooks/useIsOnline';
import { usePersistedSetting } from '@/hooks/usePersistedSetting';
import { shouldReportError } from '@/lib/appError';
import { errorReporter } from '@/observability/observability';
import { getFingerbankApiKey } from '@/scanner/fingerprint/fingerbankConfig';
import {
  buildInterrogateRequest,
  describeFingerbankError,
  queryFingerbank,
  requestSignature,
} from '@/scanner/fingerprint/fingerbank';
import { guessDevice } from '@/scanner/fingerprint/guess';
import {
  isSpecificOfflineIdentity,
  onlineIdentificationSetting,
} from '@/scanner/fingerprint/onlineIdentification';
import { deviceRegistry } from '@/scanner/registry';

// Keep well under Fingerbank's 250 req/min while staying responsive.
const MAX_IN_FLIGHT = 2;

export type FingerbankEnrichment = {
  // Non-null when the last interrogation failed. Enrichment is degraded, not the
  // scan: the LAN list still works, the names are just less precise.
  error: string | null;
  // Clears the error and re-opens the failed lookups for another attempt.
  retry: () => void;
};

// Drives online Fingerbank enrichment for LAN devices. A no-op unless a key is
// configured and the network is reachable — so an offline device still costs
// nothing. Mount once on the LAN screen.
export function useFingerbankEnrichment(): FingerbankEnrichment {
  const devices = useDevices('lan');
  const isOnline = useIsOnline();
  const apiKey = getFingerbankApiKey();
  const onlineIdentification = usePersistedSetting(onlineIdentificationSetting);

  // Signatures already interrogated this session (in-flight or resolved) — never
  // ask Fingerbank the same combination twice.
  const attempted = useRef<Set<string>>(new Set());
  // The subset of those that failed. Kept in `attempted` so a broken network does
  // not spin the request loop, and lifted back out only on an explicit retry.
  const failed = useRef<Set<string>>(new Set());
  const inFlight = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  if (abortRef.current === null) abortRef.current = new AbortController();

  const [error, setError] = useState<string | null>(null);

  // Abort any in-flight requests only when the component unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const retry = useCallback(() => {
    for (const signature of failed.current) attempted.current.delete(signature);
    failed.current.clear();
    setError(null);
  }, []);

  useEffect(() => {
    if (
      !onlineIdentification.hydrated ||
      onlineIdentification.value !== 'enabled' ||
      !apiKey ||
      isOnline === false
    )
      return;

    for (const device of devices) {
      if (inFlight.current >= MAX_IN_FLIGHT) break;
      if (device.signals.fingerbank) continue;

      const request = buildInterrogateRequest(device.signals);
      if (!request) continue;

      const signature = requestSignature(request);
      if (attempted.current.has(signature)) continue;

      // Skip only for a specific family/model, not a confident generic category.
      const best = guessDevice(device.signals)[0];
      if (isSpecificOfflineIdentity(best)) continue;

      attempted.current.add(signature);
      inFlight.current += 1;
      const { id, signals } = device;
      void queryFingerbank(signals, { apiKey, signal: abortRef.current?.signal })
        .then((outcome) => {
          if (outcome.status === 'matched') {
            deviceRegistry.enrich(id, outcome.guess);
            return;
          }
          if (outcome.status !== 'failed') return;

          failed.current.add(signature);
          setError(describeFingerbankError(outcome.error));
          if (shouldReportError(outcome.error)) {
            errorReporter.captureException(outcome.error, { context: 'fingerbank.interrogate' });
          }
        })
        .catch((error) => {
          failed.current.add(signature);
          setError('Online identification stopped unexpectedly. Try again');
          errorReporter.captureException(error, { context: 'fingerbank.enrichment' });
        })
        .finally(() => {
          inFlight.current -= 1;
        });
    }
  }, [devices, apiKey, isOnline, onlineIdentification.hydrated, onlineIdentification.value]);

  return { error, retry };
}
