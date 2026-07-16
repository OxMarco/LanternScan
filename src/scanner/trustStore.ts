import { usePersistedSetting } from '@/hooks/usePersistedSetting';
import { createPersistedSetting } from '@/lib/persistedSetting';
import type { TrustStatus } from '@/scanner/types';

type TrustLists = {
  whitelist: string[];
  blacklist: string[];
};

const EMPTY: TrustLists = { whitelist: [], blacklist: [] };

function decode(raw: string | null): TrustLists {
  if (!raw) return EMPTY;
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) return EMPTY;
  const candidate = parsed as Partial<Record<keyof TrustLists, unknown>>;
  return {
    whitelist: Array.isArray(candidate.whitelist)
      ? candidate.whitelist.filter((id): id is string => typeof id === 'string')
      : [],
    blacklist: Array.isArray(candidate.blacklist)
      ? candidate.blacklist.filter((id): id is string => typeof id === 'string')
      : [],
  };
}

export const trustListsSetting = createPersistedSetting<TrustLists>('lantern.trustLists', EMPTY, {
  decode,
  encode: JSON.stringify,
});

export function resolveTrust(deviceId: string, lists: TrustLists, isNew: boolean): TrustStatus {
  if (lists.blacklist.includes(deviceId)) return 'blacklisted';
  if (lists.whitelist.includes(deviceId)) return 'whitelisted';
  return isNew ? 'new' : 'known';
}

export async function setTrust(
  deviceId: string,
  trust: 'whitelisted' | 'blacklisted' | 'none'
): Promise<void> {
  const current = await trustListsSetting.read();
  const whitelist = current.whitelist.filter((id) => id !== deviceId);
  const blacklist = current.blacklist.filter((id) => id !== deviceId);
  if (trust === 'whitelisted') whitelist.push(deviceId);
  if (trust === 'blacklisted') blacklist.push(deviceId);
  await trustListsSetting.set({ whitelist, blacklist });
}

export function useTrustLists(): TrustLists {
  return usePersistedSetting(trustListsSetting).value;
}
