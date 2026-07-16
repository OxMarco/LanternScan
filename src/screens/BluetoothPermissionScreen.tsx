import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import PermissionStep from '@/components/PermissionStep';
import { requestBluetoothPermission, type PermissionOutcome } from '@/lib/permissions';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { markOnboardingComplete } from '@/lib/onboarding';
import { analytics, errorReporter } from '@/observability/observability';

type Props = NativeStackScreenProps<RootStackParamList, 'BluetoothPermission'>;

// Android skips the Local Network step, so this is its only permission step.
const STEP_INDEX = Platform.OS === 'ios' ? 1 : 0;
const STEP_COUNT = Platform.OS === 'ios' ? 2 : 1;

// Final onboarding step: rationale for the Bluetooth prompt. Continue triggers
// the prompt and finishes onboarding regardless of the outcome — a denied
// permission surfaces later on the Bluetooth tab, which knows how to recover.
export default function BluetoothPermissionScreen({ navigation, route }: Props) {
  const [busy, setBusy] = useState(false);
  const localNetwork = route.params?.localNetwork ?? 'granted';

  useEffect(() => {
    // Earlier steps are done once this screen mounts. Persist completion
    // immediately so an interrupted user resumes into the app, not onboarding;
    // the completion analytics below still wait for the Bluetooth answer.
    markOnboardingComplete().catch((error) => {
      errorReporter.captureException(error, { context: 'BluetoothPermissionScreen' });
    });
  }, []);

  const onContinue = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    let outcome: PermissionOutcome;
    try {
      outcome = await requestBluetoothPermission();
    } catch (error) {
      // A broken native permission bridge should not strand onboarding on a
      // permanently busy button. Continue into the app's degraded state.
      outcome = 'unavailable';
      errorReporter.captureException(error, { context: 'bluetooth-permission-request' });
    }
    analytics.track('permission_requested', { permission: 'bluetooth', outcome });
    try {
      await markOnboardingComplete();
    } catch (error) {
      // Storage write failed — proceed anyway; worst case the user sees
      // onboarding again next launch instead of being stuck here.
      errorReporter.captureException(error, { context: 'BluetoothPermissionScreen' });
    }
    analytics.track('onboarding_completed', {
      source: 'onboarding',
      local_network: localNetwork,
      bluetooth: outcome,
    });
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  }, [busy, localNetwork, navigation]);

  return (
    <PermissionStep
      icon="bluetooth"
      title="Spot what's nearby"
      body="Trackers, earbuds, and wearables broadcast over Bluetooth. LanternScan listens for them and estimates how close they are, all on your phone."
      stepIndex={STEP_INDEX}
      stepCount={STEP_COUNT}
      busy={busy}
      onContinue={() => void onContinue()}
    />
  );
}
