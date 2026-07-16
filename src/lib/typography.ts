import { Platform, type TextStyle } from 'react-native';

// System-native faces keep startup instant while giving Lantern a more
// editorial voice than the platform default. Technical identifiers use a
// dedicated mono treatment so they scan like instrument readings.
export const displayType: TextStyle = {
  fontFamily: Platform.select({
    ios: 'Avenir Next',
    android: 'sans-serif',
    default: 'system-ui',
  }),
};

export const monoType: TextStyle = {
  fontFamily: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'ui-monospace',
  }),
  fontVariant: ['tabular-nums'],
};
