import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en';
import { useTimeAgo } from 'react-time-ago';

TimeAgo.addDefaultLocale(en);

/**
 * Relative label for a timestamp: "just now", "1 minute ago", "2 hours ago".
 * Re-renders on its own as time passes, so a label stays honest while a screen
 * sits open and the device stops being sighted.
 */
export function useLastSeenLabel(timestamp: number): string {
  // `locale` is typed optional but is not: react-time-ago calls `.concat` on the
  // locale list unconditionally, so leaving it out throws on first render.
  // 'round-minute' never counts seconds out loud: a device sighted moments ago
  // reads "just now" instead of flickering through "3 seconds ago" every tick.
  return useTimeAgo({ date: timestamp, locale: 'en-US', timeStyle: 'round-minute' }).formattedDate;
}
