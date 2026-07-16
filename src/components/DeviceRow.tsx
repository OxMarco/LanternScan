import Feather from '@react-native-vector-icons/feather';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useResponsive } from '@/lib/responsive';
import { monoType } from '@/lib/typography';
import { useAppTheme } from '@/providers/ThemeProvider';
import {
  CATEGORY_ICON,
  CATEGORY_TONE,
  TONE_BG_CLASS,
  TRUST_COLOR_CLASS,
  TRUST_DOT_CLASS,
  TRUST_LABEL,
  type DevicePresentation,
} from '@/scanner/present';

type Props = {
  device: DevicePresentation;
  onPress: (id: string) => void;
};

function SignalBars({ label, s }: { label: string; s: (size: number) => number }) {
  const { theme } = useAppTheme();
  const value = Number.parseInt(label, 10);
  const activeBars = value >= -55 ? 4 : value >= -65 ? 3 : value >= -75 ? 2 : 1;

  return (
    <View accessibilityElementsHidden className="ml-3 flex-row items-end gap-0.5">
      {[4, 7, 10, 13].map((height, index) => (
        <View
          key={height}
          style={{
            width: s(2),
            height: s(height),
            borderRadius: 1,
            backgroundColor: index < activeBars ? theme.warning : theme.border,
          }}
        />
      ))}
    </View>
  );
}

function DeviceRow({ device, onPress }: Props) {
  const { theme } = useAppTheme();
  const { s } = useResponsive();
  const tone = CATEGORY_TONE[device.category];
  const toneColor = { primary: theme.text, accent: theme.warning, muted: theme.muted }[tone];
  const dot = s(6);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${device.title}, ${TRUST_LABEL[device.trust]}`}
      onPress={() => onPress(device.id)}
      style={{ minHeight: s(80) }}
      className="flex-row items-center border-b border-border py-3 active:opacity-60">
      <View
        className={`mr-3.5 items-center justify-center rounded-2xl ${TONE_BG_CLASS[tone]}`}
        style={{ width: s(44), height: s(44) }}>
        <Feather name={CATEGORY_ICON[device.category]} size={s(18)} color={toneColor} />
      </View>

      <View className="flex-1" style={{ minWidth: 0 }}>
        <View className="flex-row items-center">
          <Text
            className="mr-3 flex-1 font-semibold text-text"
            style={{ fontSize: s(16) }}
            numberOfLines={1}>
            {device.title}
          </Text>
          <View className="flex-shrink-0 flex-row items-center">
            <View
              className={`mr-1.5 rounded-full ${TRUST_DOT_CLASS[device.trust]}`}
              style={{ width: dot, height: dot }}
            />
            <Text
              className={`font-semibold ${TRUST_COLOR_CLASS[device.trust]}`}
              style={{ fontSize: s(12) }}>
              {device.trust === 'whitelisted' ? 'Familiar' : TRUST_LABEL[device.trust]}
            </Text>
          </View>
        </View>
        <View className="mt-1 flex-row items-center">
          <Text
            className="flex-1 text-muted"
            style={[monoType, { fontSize: s(12) }]}
            numberOfLines={1}>
            {device.subtitle}
          </Text>
          {device.distanceLabel ? (
            <Text className="ml-3 text-muted" style={[monoType, { fontSize: s(11) }]}>
              {device.distanceLabel}
            </Text>
          ) : null}
          {device.signalLabel ? <SignalBars label={device.signalLabel} s={s} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

export default memo(DeviceRow);
