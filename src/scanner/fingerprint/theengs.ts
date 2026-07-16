import { decodeBase64 } from '@/scanner/ble/bytes';
import { normalizeServiceUuid } from '@/scanner/fingerprint/serviceUuids';
import { THEENGS_RULES, type TheengsConditionToken } from '@/scanner/fingerprint/theengs.generated';
import type { DeviceSignals } from '@/scanner/types';

type Context = {
  manufacturerData?: string;
  serviceData?: string;
  uuid?: string;
  name?: string;
  mac?: string;
};

const LOGICAL = new Set(['&', '|']);
const LENGTH_OPERATORS = new Set(['=', '>=', '>', '<=', '<']);

function toHex(base64: string | undefined): string | undefined {
  const bytes = decodeBase64(base64);
  if (!bytes) return undefined;
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function compareLength(actual: number, operator: string, expected: number): boolean {
  if (operator === '=') return actual === expected;
  if (operator === '>=') return actual >= expected;
  if (operator === '>') return actual > expected;
  if (operator === '<=') return actual <= expected;
  if (operator === '<') return actual < expected;
  return false;
}

function reverseMac(mac: string): string {
  return (mac.match(/../g) ?? []).reverse().join('');
}

function atom(
  condition: TheengsConditionToken[],
  start: number,
  context: Context
): { value: boolean; next: number } {
  const source = condition[start];
  if (Array.isArray(source)) {
    return { value: evaluate(source, context), next: start + 1 };
  }
  if (typeof source !== 'string') return { value: false, next: start + 1 };
  if (source === 'no-mfgdata') {
    return { value: context.manufacturerData === undefined, next: start + 1 };
  }

  const data =
    source === 'manufacturerdata'
      ? context.manufacturerData
      : source === 'servicedata'
        ? context.serviceData
        : source === 'uuid'
          ? context.uuid
          : source === 'name'
            ? context.name
            : undefined;

  let next = start + 1;
  let value = data !== undefined;
  const lengthOperator = condition[next];
  if (
    typeof lengthOperator === 'string' &&
    LENGTH_OPERATORS.has(lengthOperator) &&
    typeof condition[next + 1] === 'number'
  ) {
    value =
      value && compareLength(data?.length ?? 0, lengthOperator, condition[next + 1] as number);
    next += 2;
  }

  const operation = condition[next];
  if (typeof operation !== 'string' || LOGICAL.has(operation)) return { value, next };

  if (operation === 'contain') {
    const expected = condition[next + 1];
    return {
      value:
        value && typeof expected === 'string' && Boolean(data?.includes(expected.toLowerCase())),
      next: next + 2,
    };
  }

  if (operation === 'index') {
    const offset = condition[next + 1];
    const inverse = condition[next + 2] === '!';
    const expected = condition[next + (inverse ? 3 : 2)];
    const matches =
      value &&
      typeof offset === 'number' &&
      typeof expected === 'string' &&
      data?.slice(offset, offset + expected.length).toLowerCase() === expected.toLowerCase();
    return {
      value: value && (inverse ? !matches : Boolean(matches)),
      next: next + (inverse ? 4 : 3),
    };
  }

  if (operation === 'mac@index' || operation === 'revmac@index') {
    const offset = condition[next + 1];
    const expectedMac =
      operation === 'revmac@index' && context.mac ? reverseMac(context.mac) : context.mac;
    const matches =
      value &&
      typeof offset === 'number' &&
      expectedMac !== undefined &&
      data?.slice(offset, offset + expectedMac.length).toLowerCase() === expectedMac;
    return { value: Boolean(matches), next: next + 2 };
  }

  // Unknown upstream operations fail closed and consume tokens up to the next
  // logical separator so an unsupported condition cannot cause a false match.
  while (next < condition.length && !LOGICAL.has(String(condition[next]))) next += 1;
  return { value: false, next };
}

function evaluate(condition: TheengsConditionToken[], context: Context): boolean {
  let allGroups = true;
  let anyInGroup = false;
  let index = 0;
  while (index < condition.length) {
    const result = atom(condition, index, context);
    anyInGroup ||= result.value;
    index = result.next;
    const logical = condition[index];
    if (logical === '|') {
      index += 1;
      continue;
    }
    if (logical === '&') {
      allGroups &&= anyInGroup;
      anyInGroup = false;
      index += 1;
      continue;
    }
    if (index < condition.length) return false;
  }
  return allGroups && anyInGroup;
}

function contexts(signals: DeviceSignals): Context[] {
  const manufacturerData = toHex(signals.manufacturerData);
  const name = signals.name?.toLowerCase();
  const mac = signals.mac?.replace(/[^0-9a-f]/gi, '').toLowerCase();
  const serviceData = Object.entries(signals.serviceData ?? {}).map(([uuid, payload]) => ({
    manufacturerData,
    serviceData: toHex(payload),
    uuid: normalizeServiceUuid(uuid).toLowerCase(),
    name,
    mac,
  }));
  const dataUuids = new Set(serviceData.map((entry) => entry.uuid));
  const advertised = (signals.serviceUUIDs ?? [])
    .map((uuid) => normalizeServiceUuid(uuid).toLowerCase())
    .filter((uuid) => !dataUuids.has(uuid))
    .map((uuid) => ({ manufacturerData, uuid, name, mac }));
  const combined = [...serviceData, ...advertised];
  return combined.length > 0 ? combined : [{ manufacturerData, name, mac }];
}

export function theengsDeviceLabels(signals: DeviceSignals): string[] {
  const labels = new Set<string>();
  const candidates = contexts(signals);
  for (const rule of THEENGS_RULES) {
    for (const context of candidates) {
      const condition = !context.mac && rule.conditionNoMac ? rule.conditionNoMac : rule.condition;
      if (evaluate(condition, context)) {
        labels.add(rule.label);
        break;
      }
    }
  }
  return Array.from(labels);
}
