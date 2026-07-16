import { manufacturerPayload } from '@/scanner/ble/manufacturerData';
import type { DeviceSignals } from '@/scanner/types';

const LOCAL_MODEL_PATTERNS: [RegExp, (model: string) => string][] = [
  [/\b(GVH?\d{4})(?![A-Z0-9])/i, (model) => `Govee ${model.toUpperCase()}`],
  [/\b(IBS-[A-Z0-9-]+)\b/i, (model) => `Inkbird ${model.toUpperCase()}`],
  [/\b(TP\d{2,4}[A-Z]?)\b/i, (model) => `ThermoPro ${model.toUpperCase()}`],
  [/\b(LYWSD[A-Z0-9]+|MHO-C\d+)\b/i, (model) => `Xiaomi ${model.toUpperCase()}`],
];

// Small permissive/open-format complement to the generated HA matcher table.
// These rules identify a concrete advertisement format or a model embedded in
// the public local name; they never use the rotating BLE address.
export function decodeBleFormat(signals: DeviceSignals): string | undefined {
  const name = signals.name ?? '';
  for (const [pattern, label] of LOCAL_MODEL_PATTERNS) {
    const match = name.match(pattern);
    if (match) return label(match[1]);
  }

  const payload = manufacturerPayload(signals.manufacturerData);
  if (signals.manufacturerCompanyId === 0x0499 && payload) {
    if (payload[0] === 3) return 'RuuviTag (RAWv1)';
    if (payload[0] === 5) return 'RuuviTag (RAWv2)';
  }
  if (payload?.[0] === 0xbe && payload[1] === 0xac) return 'AltBeacon';
  if (signals.manufacturerCompanyId === 0x004c && payload?.[0] === 0x02 && payload[1] === 0x15) {
    return 'iBeacon';
  }
  return undefined;
}
