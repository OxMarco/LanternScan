import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/lib/theme';

type Props = {
  onRetry: () => void;
  message?: string;
};

// Keep this screen deliberately dependency-light. It must still render when a
// provider, navigator, or styling integration is the thing that failed.
export default function SoftErrorScreen({
  onRetry,
  message = 'Your scan data is safe. Try again to reopen LanternScan.',
}: Props) {
  return (
    <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={theme.background} />
      <View style={styles.glow} />
      <View style={styles.mark}>
        <Text accessibilityElementsHidden style={styles.markText}>
          !
        </Text>
      </View>
      <Text style={styles.eyebrow}>LANTERN</Text>
      <Text style={styles.title}>LanternScan hit a snag</Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 32,
    backgroundColor: theme.background,
  },
  glow: {
    position: 'absolute',
    top: '18%',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: theme.primary,
    opacity: 0.04,
  },
  mark: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 26,
    backgroundColor: theme.surface,
  },
  markText: {
    color: theme.primary,
    fontSize: 34,
    fontWeight: '600',
  },
  eyebrow: {
    marginTop: 28,
    color: theme.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    marginTop: 12,
    color: theme.text,
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 38,
    textAlign: 'center',
  },
  message: {
    maxWidth: 340,
    marginTop: 12,
    color: theme.muted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  button: {
    minWidth: 152,
    minHeight: 52,
    marginTop: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: theme.primary,
    paddingHorizontal: 24,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: theme.primaryContrast,
    fontSize: 16,
    fontWeight: '700',
  },
});
