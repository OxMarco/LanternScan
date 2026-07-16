import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';

import PermissionStep from '@/components/PermissionStep';
import { requestLocalNetworkPermission, type PermissionOutcome } from '@/lib/permissions';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { analytics, errorReporter } from '@/observability/observability';

type Props = NativeStackScreenProps<RootStackParamList, 'LocalNetworkPermission'>;

// iOS-only onboarding step: rationale for the Local Network prompt. Continue
// triggers the prompt and always moves on — the scanner screens handle a
// denied permission gracefully.
export default function LocalNetworkPermissionScreen({ navigation }: Props) {
  const [busy, setBusy] = useState(false);

  const onContinue = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    let outcome: PermissionOutcome;
    try {
      outcome = await requestLocalNetworkPermission();
    } catch (error) {
      outcome = 'unavailable';
      errorReporter.captureException(error, { context: 'local-network-permission-request' });
    }
    analytics.track('permission_requested', { permission: 'localNetwork', outcome });
    navigation.navigate('BluetoothPermission', { localNetwork: outcome });
    // Re-arm the button: this screen stays in the stack, so an iOS swipe-back
    // must not land on a dead Continue.
    setBusy(false);
  }, [busy, navigation]);

  return (
    <PermissionStep
      icon="wifi"
      title="See who's on your Wi-Fi"
      body="LanternScan lists the devices sharing your network: your router, smart TVs, and anything you don't recognize. Nothing leaves your phone."
      stepIndex={0}
      stepCount={2}
      busy={busy}
      onContinue={() => void onContinue()}
    />
  );
}
