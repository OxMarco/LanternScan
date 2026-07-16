import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

// Scanning lives and dies with the visible tab: leaving the tab stops the radio,
// and it stays stopped — the user restarts it with SCAN. Auto-resuming on focus
// made a tab switch look like the scan had never stopped, and every round trip
// handed the scan a fresh duration window.
export function useStopScanOnBlur(stop: () => void): void {
  useFocusEffect(
    useCallback(() => {
      return stop;
    }, [stop])
  );
}
