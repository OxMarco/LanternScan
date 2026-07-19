import Feather from '@react-native-vector-icons/feather';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import LanternBackdrop from '@/components/LanternBackdrop';
import LanternField from '@/components/LanternField';
import NoticeBanner from '@/components/NoticeBanner';
import SonarListView from '@/components/SonarListView';
import WifiRequiredBanner from '@/components/WifiRequiredBanner';
import { isDemoMode } from '@/lib/demoMode';
import { useResponsive } from '@/lib/responsive';
import { displayType } from '@/lib/typography';
import { usePresentedDevices } from '@/hooks/usePresentedDevices';
import { seedDemoDevices } from '@/scanner/demo/demoSeed';
import { useStopScanOnBlur } from '@/hooks/useStopScanOnBlur';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useBleScanner } from '@/scanner/ble/useBleScanner';
import { useFingerbankEnrichment } from '@/scanner/fingerprint/useFingerbankEnrichment';
import { useRouterIdentity } from '@/scanner/lan/router';
import { useLanScanner } from '@/scanner/lan/useLanScanner';

type DiscoverMode = 'ble' | 'lan';

const LAN_STATUS: Record<string, string | undefined> = {
  offline: 'Join a Wi-Fi network to scan the devices sharing it',
  error: 'The network scan stopped unexpectedly. Tap scan to try again',
};

const BLE_STATUS: Record<string, string | undefined> = {
  unsupported: 'Bluetooth scanning needs a development build',
  unauthorized: 'Allow Bluetooth access to discover nearby devices',
  poweredOff: 'Turn on Bluetooth to discover nearby devices',
  error: 'The Bluetooth scan stopped unexpectedly. Tap scan to try again',
};

function ModeSwitch({
  mode,
  onChange,
}: {
  mode: DiscoverMode;
  onChange: (mode: DiscoverMode) => void;
}) {
  const { theme } = useAppTheme();
  const { s } = useResponsive();
  return (
    <View
      accessibilityLabel="Discovery type"
      accessibilityRole="radiogroup"
      className="mt-5 flex-row self-start rounded-full border border-border bg-surface p-1">
      {(
        [
          ['ble', 'Bluetooth', 'bluetooth'],
          ['lan', 'WiFi/LAN', 'wifi'],
        ] as const
      ).map(([value, label, icon]) => {
        const selected = mode === value;
        return (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={label}
            onPress={() => onChange(value)}
            style={{ minHeight: s(40), paddingHorizontal: s(16) }}
            className={`flex-row items-center rounded-full active:opacity-70 ${
              selected ? 'border border-primary/25 bg-primary/10' : 'border border-transparent'
            }`}>
            <Feather name={icon} size={s(14)} color={selected ? theme.primary : theme.muted} />
            <Text
              className={`ml-2 font-semibold ${selected ? 'text-text' : 'text-muted'}`}
              style={{ fontSize: s(14) }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function DiscoverScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useAppTheme();
  const { s } = useResponsive();
  const [mode, setMode] = useState<DiscoverMode>('ble');
  const lanDevices = usePresentedDevices('lan');
  const bleDevices = usePresentedDevices('ble');
  const { status: lanStatus, start: startLan, stop: stopLan } = useLanScanner();
  const { status: bleStatus, start: startBle, stop: stopBle } = useBleScanner();
  const enrichment = useFingerbankEnrichment();
  useRouterIdentity();

  // Demo builds have no live radios; present the curated scene as a perpetual
  // scan so the field/sonar animate for screenshots.
  const effectiveBleStatus = isDemoMode ? 'scanning' : bleStatus;
  const effectiveLanStatus = isDemoMode ? 'scanning' : lanStatus;

  const stopAll = useCallback(() => {
    stopLan();
    stopBle();
  }, [stopBle, stopLan]);
  useStopScanOnBlur(stopAll);

  const onModeChange = useCallback(
    (nextMode: DiscoverMode) => {
      if (nextMode === mode) return;
      stopAll();
      setMode(nextMode);
    },
    [mode, stopAll]
  );

  const onToggleScan = useCallback(() => {
    if (isDemoMode) {
      void seedDemoDevices();
      return;
    }
    if (mode === 'lan') {
      if (lanStatus === 'scanning') stopLan();
      else void startLan();
    } else if (bleStatus === 'scanning') stopBle();
    else void startBle();
  }, [bleStatus, lanStatus, mode, startBle, startLan, stopBle, stopLan]);

  const onSelect = useCallback(
    (id: string) => navigation.navigate('DeviceDetail', { deviceId: id }),
    [navigation]
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'right', 'bottom', 'left']}>
      <LanternBackdrop />
      {mode === 'lan' && !isDemoMode ? <WifiRequiredBanner /> : null}
      {mode === 'lan' && enrichment.error ? (
        <NoticeBanner
          icon="alert-circle"
          message={enrichment.error}
          actionLabel="Retry"
          onAction={enrichment.retry}
        />
      ) : null}

      <View className="px-5">
        <View className="flex-row items-center justify-between pt-4">
          <View className="flex-row items-center">
            <Text
              className="font-semibold tracking-[2px] text-text"
              style={[displayType, { fontSize: s(16) }]}>
              LANTERN
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            hitSlop={8}
            onPress={() => navigation.navigate('Settings')}
            style={{ width: s(44), height: s(44) }}
            className="items-center justify-center rounded-full border border-border bg-surface active:opacity-60">
            <Feather name="sliders" size={s(18)} color={theme.text} />
          </Pressable>
        </View>
        <ModeSwitch mode={mode} onChange={onModeChange} />
      </View>

      {mode === 'ble' ? (
        <LanternField
          devices={bleDevices}
          scanning={effectiveBleStatus === 'scanning'}
          statusMessage={BLE_STATUS[effectiveBleStatus]}
          onToggleScan={onToggleScan}
          onSelect={onSelect}
        />
      ) : (
        <SonarListView
          devices={lanDevices}
          scanning={effectiveLanStatus === 'scanning'}
          statusMessage={LAN_STATUS[effectiveLanStatus]}
          onToggleScan={onToggleScan}
          onSelect={onSelect}
        />
      )}
    </SafeAreaView>
  );
}
