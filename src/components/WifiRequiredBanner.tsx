import { useNetInfo } from '@react-native-community/netinfo';

import NoticeBanner from '@/components/NoticeBanner';

export function needsWifiConnection(type: string): boolean {
  // Avoid flashing the warning while NetInfo is still resolving the active
  // transport. Once resolved, LAN discovery specifically requires Wi-Fi.
  return type !== 'wifi' && type !== 'unknown';
}

export default function WifiRequiredBanner() {
  const { type } = useNetInfo();

  if (!needsWifiConnection(type)) return null;

  return <NoticeBanner icon="wifi-off" message="Connect to Wi-Fi to scan your local network" />;
}
