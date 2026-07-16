import { View } from 'react-native';

import { useAppTheme } from '@/providers/ThemeProvider';

// A restrained pool of ambient light shared by every screen. It gives the
// dark-only interface depth without turning the background into decoration.
export default function LanternBackdrop() {
  const { theme } = useAppTheme();

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="absolute inset-0 overflow-hidden">
      <View
        style={{
          position: 'absolute',
          width: 390,
          height: 390,
          borderRadius: 195,
          right: -235,
          top: -205,
          backgroundColor: theme.primary,
          opacity: 0.035,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 310,
          height: 310,
          borderRadius: 155,
          left: -245,
          top: '42%',
          borderWidth: 1,
          borderColor: theme.primary,
          opacity: 0.055,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 420,
          height: 420,
          borderRadius: 210,
          right: -290,
          bottom: -300,
          backgroundColor: theme.primary,
          opacity: 0.018,
        }}
      />
    </View>
  );
}
