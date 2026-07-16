import { bytesToHex, decodeBase64 } from '@/scanner/ble/bytes';
import { FAST_PAIR_MODELS } from '@/scanner/fingerprint/fastPairModels.generated';

const FAST_PAIR_SERVICE = 'fe2c';

// Google Fast Pair devices in pairing mode advertise their 3-byte model ID as
// the entire 0xFE2C service-data payload; idle devices advertise an account
// key filter instead (longer payload, no model ID).
export function decodeFastPairModel(
  serviceData: Record<string, string> | undefined
): string | undefined {
  const payload = decodeBase64(serviceData?.[FAST_PAIR_SERVICE]);
  if (!payload || payload.length !== 3) return undefined;
  return FAST_PAIR_MODELS[bytesToHex(payload)];
}
