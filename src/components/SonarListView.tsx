import Feather from '@react-native-vector-icons/feather';
import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  FlatList,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';

import DeviceRow from '@/components/DeviceRow';
import { useResponsive } from '@/lib/responsive';
import { displayType } from '@/lib/typography';
import { useAppTheme } from '@/providers/ThemeProvider';
import type { DevicePresentation } from '@/scanner/present';

const SONAR_HEIGHT = 224;
const RIPPLE_COUNT = 3;
const RIPPLE_DURATION = 3400;

const GROUP_ORDER: Record<DevicePresentation['trust'], number> = {
  blacklisted: 0,
  new: 1,
  whitelisted: 2,
  known: 3,
};

// The pulse makes no spatial claims — it is a heartbeat, not a map — so the
// shimmer positions only need to be stable per device, never meaningful.
function shimmerPosition(id: string): { left: `${number}%`; top: `${number}%` } {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index++) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const unit = (hash >>> 0) / 4294967296;
  const angle = unit * Math.PI * 2;
  const radius = 0.24 + (((hash >>> 8) % 100) / 100) * 0.22;
  return {
    left: `${50 + Math.cos(angle) * radius * 100}%`,
    top: `${50 + Math.sin(angle) * radius * 100}%`,
  };
}

function Ripple({ order, active, size }: { order: number; active: boolean; size: number }) {
  const { theme } = useAppTheme();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    if (!active) return;
    let animation: Animated.CompositeAnimation | undefined;
    const stagger = setTimeout(
      () => {
        animation = Animated.loop(
          Animated.timing(progress, {
            toValue: 1,
            duration: RIPPLE_DURATION,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: Platform.OS !== 'web',
          })
        );
        animation.start();
      },
      order * (RIPPLE_DURATION / RIPPLE_COUNT)
    );
    return () => {
      clearTimeout(stagger);
      animation?.stop();
    };
  }, [active, order, progress]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: theme.primary,
        opacity: progress.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.4, 0] }),
        transform: [
          { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.24, 1] }) },
        ],
      }}
    />
  );
}

function SonarPulse({
  scanning,
  reduceMotion,
  shimmerIds,
  onToggleScan,
}: {
  scanning: boolean;
  reduceMotion: boolean;
  shimmerIds: string[];
  onToggleScan: () => void;
}) {
  const { theme } = useAppTheme();
  const { s } = useResponsive();
  const animate = scanning && !reduceMotion;
  const control = s(108);
  const staticRing = s(190);

  return (
    <View style={{ height: s(SONAR_HEIGHT) }} className="overflow-hidden">
      {Array.from({ length: RIPPLE_COUNT }, (_, order) => (
        <Ripple key={order} order={order} active={animate} size={s(280)} />
      ))}
      {!animate && scanning ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: staticRing,
            height: staticRing,
            marginLeft: -staticRing / 2,
            marginTop: -staticRing / 2,
            borderRadius: staticRing / 2,
            borderWidth: 1.5,
            borderColor: theme.primary,
            opacity: 0.22,
          }}
        />
      ) : null}

      {shimmerIds.map((id) => {
        const position = shimmerPosition(id);
        const dot = s(5);
        return (
          <View
            key={id}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: position.left,
              top: position.top,
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: theme.accent,
              opacity: 0.6,
            }}
          />
        );
      })}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={scanning ? 'Stop scanning' : 'Start scanning'}
        accessibilityState={{ busy: scanning }}
        onPress={onToggleScan}
        className="absolute items-center justify-center active:opacity-70"
        style={{
          left: '50%',
          top: '50%',
          width: control,
          height: control,
          marginLeft: -control / 2,
          marginTop: -control / 2,
          borderRadius: control / 2,
          backgroundColor: scanning ? theme.inverse : theme.primary,
          borderWidth: scanning ? 1 : 0,
          borderColor: theme.primary,
        }}>
        <Feather
          name={scanning ? 'square' : 'radio'}
          size={s(24)}
          color={scanning ? theme.primary : theme.primaryContrast}
        />
        <Text
          className="mt-1 font-bold uppercase tracking-[1.4px]"
          style={{ fontSize: s(9), color: scanning ? theme.inverseText : theme.primaryContrast }}>
          {scanning ? 'STOP' : 'SCAN'}
        </Text>
      </Pressable>
    </View>
  );
}

export default function SonarListView({
  devices,
  scanning,
  statusMessage,
  onToggleScan,
  onSelect,
}: {
  devices: DevicePresentation[];
  scanning: boolean;
  statusMessage?: string;
  onToggleScan: () => void;
  onSelect: (id: string) => void;
}) {
  const { theme } = useAppTheme();
  const { s } = useResponsive();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => undefined);
  }, []);

  const sorted = useMemo(
    () =>
      [...devices].sort(
        (a, b) => GROUP_ORDER[a.trust] - GROUP_ORDER[b.trust] || b.lastSeenAt - a.lastSeenAt
      ),
    [devices]
  );

  const counts = useMemo(
    () => ({
      new: devices.filter((device) => device.trust === 'new').length,
      flagged: devices.filter((device) => device.trust === 'blacklisted').length,
    }),
    [devices]
  );
  const headline = counts.flagged
    ? `${counts.flagged} ${counts.flagged === 1 ? 'device needs' : 'devices need'} attention`
    : counts.new
      ? `${counts.new} new ${counts.new === 1 ? 'device' : 'devices'} found`
      : devices.length
        ? 'Everything looks familiar'
        : scanning
          ? 'Asking the network who’s there'
          : '';

  return (
    <FlatList
      data={sorted}
      keyExtractor={(device) => device.id}
      renderItem={({ item }) => <DeviceRow device={item} onPress={onSelect} />}
      contentContainerStyle={{
        width: '100%',
        maxWidth: 720,
        alignSelf: 'center',
        paddingHorizontal: 20,
        paddingBottom: 40,
      }}
      ListHeaderComponent={
        <View>
          <SonarPulse
            scanning={scanning}
            reduceMotion={reduceMotion}
            shimmerIds={sorted.slice(0, 8).map((device) => device.id)}
            onToggleScan={onToggleScan}
          />
          <Text
            accessibilityLiveRegion="polite"
            className="text-center font-semibold text-text"
            style={[displayType, { fontSize: s(22) }]}>
            {headline}
          </Text>

          {statusMessage ? (
            <View className="mt-5 flex-row items-start rounded-2xl bg-warning/10 px-4 py-3.5">
              <Feather name="alert-circle" size={s(16)} color={theme.warning} />
              <Text
                className="ml-3 flex-1 font-medium leading-5 text-warning"
                style={{ fontSize: s(14) }}>
                {statusMessage}
              </Text>
            </View>
          ) : null}

          {sorted.length > 0 ? (
            <View className="mt-6 border-b border-border pb-2">
              <Text className="font-semibold text-text" style={[displayType, { fontSize: s(16) }]}>
                On your network
              </Text>
              {/* "Two kinds of near": network reachability says nothing about
                  physical distance, so this list explicitly claims none. */}
              <Text className="mt-1 text-muted" style={{ fontSize: s(12) }}>
                Reachable over Wi-Fi, not ranked by distance
              </Text>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <View className="items-center px-8 pb-16 pt-10">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
            <Feather name={scanning ? 'radio' : 'wifi'} size={20} color={theme.warning} />
          </View>
          <Text className="mt-5 text-center text-lg font-semibold text-text" style={displayType}>
            {scanning ? 'Devices will appear as they answer' : 'No devices discovered yet'}
          </Text>
          <Text className="mt-2 max-w-[270px] text-center text-sm leading-5 text-muted">
            {scanning
              ? 'Keep LanternScan open while it asks the network around you'
              : 'Tap the pulse above to start a private scan'}
          </Text>
        </View>
      }
    />
  );
}
