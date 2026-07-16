import { ActivityIndicator, Pressable, Text } from 'react-native';

import { useAppTheme } from '@/providers/ThemeProvider';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline';
};

export default function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: Props) {
  const { theme } = useAppTheme();
  const unavailable = loading || disabled;
  const outline = variant === 'outline';

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      onPress={onPress}
      style={
        outline
          ? undefined
          : {
              shadowColor: theme.primary,
              shadowOpacity: 0.18,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 4,
            }
      }
      className={`min-h-14 items-center justify-center rounded-full px-6 ${
        outline ? 'border border-primary/30 bg-primary/10' : 'bg-primary'
      } ${unavailable ? 'opacity-50' : 'active:opacity-80'}`}>
      {loading ? (
        <ActivityIndicator color={outline ? theme.primary : theme.primaryContrast} />
      ) : (
        <Text
          className={`text-base font-bold ${outline ? 'text-primary' : 'text-primaryContrast'}`}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
