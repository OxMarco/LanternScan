import Feather from '@react-native-vector-icons/feather';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, Text, View } from 'react-native';

import { useResponsive } from '@/lib/responsive';
import { monoType } from '@/lib/typography';
import { useAppTheme } from '@/providers/ThemeProvider';
import {
  CATEGORY_ICON,
  TRUST_DOT_CLASS,
  TRUST_LABEL,
  type DevicePresentation,
} from '@/scanner/present';

// Beyond this the field stops being legible; the farthest lights are summarised
// by the "+N farther" tally instead.
const MAX_FIELD_DEVICES = 12;

// The two ring radii double as honest distance marks. RSSI ranging is coarse,
// so the field only ever claims three zones, not positions.
const RING_INNER_METERS = 2;
const RING_MID_METERS = 6;

function bandLabel(distanceMeters: number | undefined): string {
  if (distanceMeters === undefined) return 'Nearby';
  if (distanceMeters < RING_INNER_METERS) return 'Right here';
  if (distanceMeters < RING_MID_METERS) return 'Same room';
  return 'Farther away';
}

// Angle comes from a stable hash of the device id: bearing is unknowable from
// RSSI, so the direction is arbitrary but must not reshuffle between renders.
function angleForId(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index++) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 4294967296) * Math.PI * 2;
}

// Piecewise mapping keeps each zone's dots between its rings regardless of the
// absolute distance estimate. The inner floor clears the centre control.
function radiusRatioForDistance(distanceMeters: number | undefined): number {
  if (distanceMeters === undefined) return 0.96;
  if (distanceMeters < RING_INNER_METERS) {
    return 0.46 + (distanceMeters / RING_INNER_METERS) * 0.12;
  }
  if (distanceMeters < RING_MID_METERS) {
    return (
      0.68 + ((distanceMeters - RING_INNER_METERS) / (RING_MID_METERS - RING_INNER_METERS)) * 0.14
    );
  }
  return 0.9 + Math.min((distanceMeters - RING_MID_METERS) / 10, 1) * 0.1;
}

type Placement = {
  device: DevicePresentation;
  ratio: number;
  angle: number;
  halfWidth: number;
};

// Hashed angles collide; since bearing is invented anyway, lights that share a
// band may be nudged apart until their labels no longer stack. Deterministic,
// and only crowded neighbours move.
function relaxAngles(items: Placement[], bandRadiusPx: number, gapPx: number): void {
  if (items.length < 2 || bandRadiusPx <= 0) return;
  items.sort((a, b) => a.angle - b.angle);
  for (let pass = 0; pass < 6; pass++) {
    let moved = false;
    for (let index = 0; index < items.length; index++) {
      const current = items[index];
      const next = items[(index + 1) % items.length];
      const wrap = index === items.length - 1 ? Math.PI * 2 : 0;
      const gap = next.angle + wrap - current.angle;
      const needed = (current.halfWidth + next.halfWidth + gapPx) / bandRadiusPx;
      if (gap < needed) {
        const shift = (needed - gap) / 2;
        current.angle -= shift;
        next.angle += shift;
        moved = true;
      }
    }
    if (!moved) break;
  }
}

function signalOpacity(signalLabel: string | undefined): number {
  if (!signalLabel) return 0.8;
  const rssi = Number.parseInt(signalLabel, 10);
  if (Number.isNaN(rssi)) return 0.8;
  if (rssi >= -55) return 1;
  if (rssi >= -65) return 0.88;
  if (rssi >= -75) return 0.68;
  return 0.5;
}

function FieldLight({
  device,
  x,
  y,
  index,
  selected,
  reduceMotion,
  s,
  onPress,
}: {
  device: DevicePresentation;
  x: number;
  y: number;
  index: number;
  selected: boolean;
  reduceMotion: boolean;
  s: (size: number) => number;
  onPress: (id: string) => void;
}) {
  const { theme } = useAppTheme();
  const [entrance] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  const glow = signalOpacity(device.signalLabel);
  // Unnamed devices stay small, unlabelled points: they are most of any real
  // scan, and giving each a caption is what buries the field.
  const compact = !device.named;
  const circle = s(compact ? 26 : 42);
  const labelWidth = s(76);

  useEffect(() => {
    if (reduceMotion) {
      entrance.setValue(1);
      return;
    }
    const animation = Animated.sequence([
      Animated.delay(Math.min(index, 8) * 60),
      Animated.timing(entrance, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.back(1.3)),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [entrance, index, reduceMotion]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x - (compact ? circle / 2 : labelWidth / 2),
        top: y - circle / 2,
        width: compact ? circle : labelWidth,
        alignItems: 'center',
        opacity: entrance.interpolate({ inputRange: [0, 1], outputRange: [0, glow] }),
        transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
      }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${device.title}, ${bandLabel(device.distanceMeters)}, ${TRUST_LABEL[device.trust]}`}
        onPress={() => onPress(device.id)}
        hitSlop={compact ? 10 : 0}
        className="items-center active:opacity-60">
        <View
          style={{
            width: circle,
            height: circle,
            borderRadius: circle / 2,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: selected ? theme.primary : 'rgba(250, 245, 233, 0.22)',
            backgroundColor: selected ? 'rgba(255, 212, 90, 0.16)' : 'rgba(250, 245, 233, 0.07)',
            shadowColor: theme.primary,
            shadowOpacity: selected ? 0.55 : 0.3,
            shadowRadius: selected ? 14 : 9,
            shadowOffset: { width: 0, height: 0 },
            elevation: selected ? 6 : 3,
          }}>
          <Feather
            name={CATEGORY_ICON[device.category]}
            size={s(compact ? 12 : 17)}
            color={selected ? theme.primary : compact ? theme.inverseMuted : theme.inverseText}
          />
          <View
            className={`absolute -right-0.5 -top-0.5 rounded-full ${TRUST_DOT_CLASS[device.trust]}`}
            style={{
              width: s(compact ? 6 : 8),
              height: s(compact ? 6 : 8),
              borderWidth: compact ? 1 : 1.5,
              borderColor: theme.inverse,
            }}
          />
        </View>
        {compact ? null : (
          <Text
            numberOfLines={1}
            style={{
              width: labelWidth,
              marginTop: s(5),
              textAlign: 'center',
              fontSize: s(10),
              fontWeight: '600',
              color: selected ? theme.primary : theme.inverseMuted,
            }}>
            {device.title}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function LanternField({
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
  const [pulse] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fieldSize, setFieldSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    pulse.stopAnimation();
    pulse.setValue(0);
    if (!scanning || reduceMotion) return;
    const animation = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 2200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reduceMotion, scanning]);

  const { visible, total, hiddenCount } = useMemo(() => {
    const sorted = [...devices].sort((a, b) => {
      const left = a.distanceMeters ?? Number.POSITIVE_INFINITY;
      const right = b.distanceMeters ?? Number.POSITIVE_INFINITY;
      return left - right || b.lastSeenAt - a.lastSeenAt;
    });
    const nearest = sorted.slice(0, MAX_FIELD_DEVICES);
    return { visible: nearest, total: sorted.length, hiddenCount: sorted.length - nearest.length };
  }, [devices]);

  const selected = visible.find((device) => device.id === selectedId) ?? null;

  const layout = useMemo(() => {
    if (!fieldSize) return null;
    const cx = fieldSize.width / 2;
    const cy = fieldSize.height / 2;
    // The field is portrait: stretch the bands into an ellipse so the tall
    // screen carries the crowd instead of squeezing it against the width.
    const rx = fieldSize.width / 2 - s(52);
    const ry = Math.min(fieldSize.height / 2 - s(68), rx * 2);
    if (rx <= 40 || ry <= 40) return null;

    const bands = new Map<string, Placement[]>();
    for (const device of visible) {
      const item: Placement = {
        device,
        ratio: radiusRatioForDistance(device.distanceMeters),
        angle: angleForId(device.id),
        halfWidth: device.named ? s(46) : s(20),
      };
      const band = bandLabel(device.distanceMeters);
      bands.set(band, [...(bands.get(band) ?? []), item]);
    }
    for (const items of bands.values()) {
      const meanRatio = items.reduce((sum, item) => sum + item.ratio, 0) / items.length;
      relaxAngles(items, meanRatio * ((rx + ry) / 2), s(12));
    }

    const edge = s(40);
    const placed = [...bands.values()].flat().map(({ device, ratio, angle }) => ({
      device,
      x: clamp(cx + Math.cos(angle) * ratio * rx, edge, fieldSize.width - edge),
      y: clamp(cy + Math.sin(angle) * ratio * ry, s(26), fieldSize.height - s(56)),
    }));
    return { cx, cy, rx, ry, placed };
  }, [fieldSize, visible, s]);

  const control = s(72);
  const glowOuter = s(140);
  const glowPulse = s(104);

  return (
    <View
      className="mx-5 mb-4 mt-5 flex-1 overflow-hidden rounded-[36px] border border-primary/10 bg-inverse"
      style={{
        shadowColor: theme.primary,
        shadowOpacity: 0.08,
        shadowRadius: 32,
        shadowOffset: { width: 0, height: 16 },
        elevation: 5,
      }}>
      <View className="flex-row items-center justify-between px-5 pt-5">
        <Text
          className="font-semibold uppercase tracking-[1.8px] text-inverseMuted"
          style={{ fontSize: s(11) }}>
          Nearby Bluetooth
        </Text>
      </View>

      {statusMessage ? (
        <View className="mx-5 mt-3 flex-row items-start rounded-2xl bg-warning/10 px-4 py-3">
          <Feather name="alert-circle" size={s(15)} color={theme.warning} />
          <Text
            className="ml-2.5 flex-1 font-medium leading-5 text-warning"
            style={{ fontSize: s(13) }}>
            {statusMessage}
          </Text>
        </View>
      ) : null}

      <View
        className="flex-1"
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setFieldSize({ width, height });
        }}>
        {layout ? (
          <>
            {/* Distance rings, marked in honest metres rather than implied precision. */}
            {(
              [
                [0.63, `${RING_INNER_METERS} m`],
                [0.86, `${RING_MID_METERS} m`],
                [1.08, undefined],
              ] as const
            ).map(([ratio, label]) => {
              const radius = layout.rx * ratio;
              return (
                <View key={ratio} pointerEvents="none">
                  <View
                    style={{
                      position: 'absolute',
                      left: layout.cx - radius,
                      top: layout.cy - radius,
                      width: radius * 2,
                      height: radius * 2,
                      borderRadius: radius,
                      borderWidth: 1,
                      borderColor: 'rgba(250, 245, 233, 0.08)',
                      transform: [{ scaleY: layout.ry / layout.rx }],
                    }}
                  />
                  {label ? (
                    <Text
                      style={[
                        monoType,
                        {
                          position: 'absolute',
                          left: layout.cx - s(14),
                          top: layout.cy - ratio * layout.ry - s(7),
                          fontSize: s(9),
                          color: 'rgba(250, 245, 233, 0.32)',
                          backgroundColor: theme.inverse,
                          paddingHorizontal: 4,
                        },
                      ]}>
                      {label}
                    </Text>
                  ) : null}
                </View>
              );
            })}

            {/* Lantern glow behind the centre control. */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: layout.cx - glowOuter / 2,
                top: layout.cy - glowOuter / 2,
                width: glowOuter,
                height: glowOuter,
                borderRadius: glowOuter / 2,
                backgroundColor: theme.primary,
                opacity: 0.05,
              }}
            />
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: layout.cx - glowPulse / 2,
                top: layout.cy - glowPulse / 2,
                width: glowPulse,
                height: glowPulse,
                borderRadius: glowPulse / 2,
                backgroundColor: theme.primary,
                opacity: scanning
                  ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.26, 0] })
                  : 0.09,
                transform: [
                  {
                    scale: scanning
                      ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 2.1] })
                      : 1,
                  },
                ],
              }}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={scanning ? 'Stop scanning' : 'Start scanning'}
              accessibilityState={{ busy: scanning }}
              onPress={onToggleScan}
              style={{
                position: 'absolute',
                left: layout.cx - control / 2,
                top: layout.cy - control / 2,
                width: control,
                height: control,
                borderRadius: control / 2,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: scanning ? theme.inverse : theme.primary,
                borderWidth: scanning ? 1 : 0,
                borderColor: theme.primary,
              }}>
              <Feather
                name={scanning ? 'square' : 'radio'}
                size={s(17)}
                color={scanning ? theme.primary : theme.primaryContrast}
              />
              <Text
                style={{
                  marginTop: s(4),
                  fontSize: s(8),
                  fontWeight: '800',
                  letterSpacing: 1.6,
                  color: scanning ? theme.inverseText : theme.primaryContrast,
                }}>
                {scanning ? 'STOP' : 'SCAN'}
              </Text>
            </Pressable>

            {layout.placed.map(({ device, x, y }, index) => (
              <FieldLight
                key={device.id}
                device={device}
                x={x}
                y={y}
                index={index}
                selected={device.id === selectedId}
                reduceMotion={reduceMotion}
                s={s}
                onPress={(id) => setSelectedId((current) => (current === id ? null : id))}
              />
            ))}

            {visible.length === 0 ? (
              <Text
                className="absolute w-full text-center leading-5 text-inverseMuted"
                style={{ top: layout.cy + s(64), fontSize: s(13) }}>
                {scanning
                  ? 'Listening for nearby Bluetooth…'
                  : 'Tap the lantern to light up the room'}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>

      <View className="px-4 pb-4">
        {selected ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${selected.title}`}
            onPress={() => onSelect(selected.id)}
            className="flex-row items-center rounded-3xl border border-inverseText/10 bg-inverseText/5 px-4 py-3.5 active:opacity-70">
            <View
              className="items-center justify-center rounded-2xl bg-primary/15"
              style={{ width: s(40), height: s(40) }}>
              <Feather name={CATEGORY_ICON[selected.category]} size={s(18)} color={theme.primary} />
            </View>
            <View className="ml-3 flex-1">
              <Text
                className="font-semibold text-inverseText"
                style={{ fontSize: s(15) }}
                numberOfLines={1}>
                {selected.title}
              </Text>
              <Text
                className="mt-0.5 text-inverseMuted"
                style={{ fontSize: s(12) }}
                numberOfLines={1}>
                {bandLabel(selected.distanceMeters)}
                {selected.distanceLabel ? `  ·  ${selected.distanceLabel}` : ''}
                {selected.signalLabel ? `  ·  ${selected.signalLabel}` : ''}
              </Text>
            </View>
            <Feather name="chevron-right" size={s(18)} color={theme.inverseMuted} />
          </Pressable>
        ) : (
          <View className="flex-row items-center justify-between px-1">
            <Text className="text-inverseMuted" style={{ fontSize: s(12) }}>
              {visible.length
                ? `${total} ${total === 1 ? 'light' : 'lights'} · tap one to inspect`
                : 'Private scan · on this phone'}
            </Text>
            {hiddenCount > 0 ? (
              <Text className="font-semibold text-inverseMuted" style={{ fontSize: s(12) }}>
                +{hiddenCount} farther
              </Text>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
