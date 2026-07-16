import Feather from '@react-native-vector-icons/feather';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/providers/ThemeProvider';

type Props = {
  icon: ComponentProps<typeof Feather>['name'];
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

// A non-blocking alert pill for degraded-but-usable states: the screen still
// works, something on it just doesn't.
export default function NoticeBanner({ icon, message, actionLabel, onAction }: Props) {
  const { theme } = useAppTheme();

  return (
    <View className="px-5 pt-2">
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        className="flex-row items-center justify-center rounded-full bg-error/10 px-5 py-2.5">
        <Feather name={icon} size={14} color={theme.error} />
        <Text className="ml-2 flex-shrink text-sm font-semibold text-error">{message}</Text>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityLabel={actionLabel}
            accessibilityRole="button"
            className="ml-3 active:opacity-60"
            hitSlop={12}
            onPress={onAction}>
            <Text className="text-sm font-bold text-error underline">{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
