import { useWindowDimensions } from 'react-native';

// Lantern's layout is hand-tuned for phones. Rather than redesign per device,
// tablets keep the same composition scaled up from the screen's shortest side,
// so icons, controls, and type stay legible instead of marooned in a sea of
// black. Phones (shortest side below the threshold) render at their native 1×.
const TABLET_MIN_SHORTEST = 700;
// Divisor and clamp chosen so an iPad mini (~744 pt) lands at the 1.25 floor and
// a 13" iPad Pro (~1024 pt) reaches the 1.5 ceiling — a noticeable bump that
// never balloons the UI.
const SCALE_DIVISOR = 680;
const SCALE_MIN = 1.25;
const SCALE_MAX = 1.5;

export type Responsive = {
  scale: number;
  isTablet: boolean;
  /** Scale a phone-tuned pixel size for the current device, rounded. */
  s: (size: number) => number;
};

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  const shortest = Math.min(width, height);
  const isTablet = shortest >= TABLET_MIN_SHORTEST;
  const scale = isTablet ? Math.min(Math.max(shortest / SCALE_DIVISOR, SCALE_MIN), SCALE_MAX) : 1;
  return { scale, isTablet, s: (size: number) => Math.round(size * scale) };
}
