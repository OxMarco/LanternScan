import {
  DarkTheme,
  NavigationContainer,
  type Theme as NavigationTheme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import ErrorBoundary from '@/components/ErrorBoundary';
import { isDemoMode } from '@/lib/demoMode';
import { isOnboardingComplete } from '@/lib/onboarding';
import { analytics } from '@/observability/observability';
import { useAppTheme } from '@/providers/ThemeProvider';
import type { PermissionOutcome } from '@/lib/permissions';
import BluetoothPermissionScreen from '@/screens/BluetoothPermissionScreen';
import DiscoverScreen from '@/screens/DiscoverScreen';
import DeviceDetailScreen from '@/screens/DeviceDetailScreen';
import LocalNetworkPermissionScreen from '@/screens/LocalNetworkPermissionScreen';
import PrivacyScreen from '@/screens/PrivacyScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import WelcomeScreen from '@/screens/WelcomeScreen';

export type RootStackParamList = {
  Welcome: undefined;
  // iOS-only rationale step; Android goes straight to Bluetooth.
  LocalNetworkPermission: undefined;
  // Final onboarding step; carries how the local-network step resolved so the
  // onboarding_completed event it fires can record both permissions.
  BluetoothPermission: { localNetwork: PermissionOutcome };
  Main: undefined;
  Settings: undefined;
  Privacy: undefined;
  DeviceDetail: { deviceId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { theme } = useAppTheme();
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const currentRouteName = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Demo builds jump straight to the populated Discover screen — onboarding
    // asks for permissions the seeded scene never needs.
    if (isDemoMode) {
      setInitialRoute('Main');
      return;
    }
    let cancelled = false;
    isOnboardingComplete()
      .then((complete) => {
        if (!cancelled) setInitialRoute(complete ? 'Main' : 'Welcome');
      })
      .catch(() => {
        if (!cancelled) setInitialRoute('Welcome');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const navigationTheme = useMemo<NavigationTheme>(() => {
    return {
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        primary: theme.primary,
        background: theme.background,
        card: theme.surface,
        text: theme.text,
        border: theme.border,
        notification: theme.error,
      },
    };
  }, [theme]);

  const trackCurrentRoute = () => {
    const routeName = navigationRef.getCurrentRoute()?.name;
    if (routeName && currentRouteName.current !== routeName) {
      currentRouteName.current = routeName;
      analytics.screen(routeName);
    }
  };

  if (!initialRoute) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      onReady={trackCurrentRoute}
      onStateChange={trackCurrentRoute}>
      <StatusBar style="light" />
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="LocalNetworkPermission" component={LocalNetworkPermissionScreen} />
        <Stack.Screen name="BluetoothPermission" component={BluetoothPermissionScreen} />
        <Stack.Screen name="Main" component={DiscoverScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Privacy" component={PrivacyScreen} />
        <Stack.Screen name="DeviceDetail">
          {() => (
            <ErrorBoundary context="DeviceDetailScreen">
              <DeviceDetailScreen />
            </ErrorBoundary>
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
