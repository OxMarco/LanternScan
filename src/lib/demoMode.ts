// Demo mode replaces live BLE/LAN scanning with a curated set of fictional
// devices so App Store / Play Store screenshots show a rich, consistent, and
// privacy-safe scene on any simulator — no real hardware, and none of the
// screenshotter's own devices leaking into the store listing.
//
// Enable it with EXPO_PUBLIC_DEMO=1 at build time, e.g.
//   EXPO_PUBLIC_DEMO=1 npx expo run:ios
// Expo statically inlines EXPO_PUBLIC_* values, so this is a compile-time
// constant and normal (non-demo) builds tree-shake the demo code away.
export const isDemoMode = process.env.EXPO_PUBLIC_DEMO === '1';
