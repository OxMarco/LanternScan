import 'react-native-gesture-handler';

import { useCallback, useEffect, useState } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import SoftErrorScreen from '@/components/SoftErrorScreen';
import { isDemoMode } from '@/lib/demoMode';
import RootNavigator from '@/navigation/RootNavigator';
import { installGlobalErrorHandlers } from '@/observability/globalHandlers';
import AppProviders from '@/providers/AppProviders';
import { seedDemoDevices } from '@/scanner/demo/demoSeed';

import './global.css';

export default function App() {
  const [runtimeError, setRuntimeError] = useState<Error | null>(null);

  useEffect(
    () =>
      installGlobalErrorHandlers((error) => {
        setRuntimeError(error);
        return true;
      }),
    []
  );

  useEffect(() => {
    if (isDemoMode) void seedDemoDevices();
  }, []);

  const retry = useCallback(() => setRuntimeError(null), []);

  if (runtimeError) return <SoftErrorScreen onRetry={retry} />;

  return (
    <ErrorBoundary context="App">
      <AppProviders>
        <RootNavigator />
      </AppProviders>
    </ErrorBoundary>
  );
}
