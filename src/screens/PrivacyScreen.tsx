import Feather from '@react-native-vector-icons/feather';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert, Linking, Pressable, Text, View } from 'react-native';

import Screen from '@/components/Screen';
import { displayType } from '@/lib/typography';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { useAppTheme } from '@/providers/ThemeProvider';

function PolicySection({ title, body }: { title: string; body: string }) {
  return (
    <View className="mt-7 border-t border-border pt-6">
      <Text className="text-lg font-semibold text-text" style={displayType}>
        {title}
      </Text>
      <Text className="mt-2 text-sm leading-6 text-muted" selectable>
        {body}
      </Text>
    </View>
  );
}

export default function PrivacyScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useAppTheme();
  const openFingerbankPrivacy = () => {
    void Linking.openURL('https://www.fingerbank.org/privacy/').catch(() => {
      Alert.alert('Couldn’t open the page', 'Check your connection and try again.');
    });
  };

  return (
    <Screen scroll>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to settings"
        onPress={() => navigation.goBack()}
        className="h-11 w-11 items-center justify-center rounded-full border border-border bg-surface active:opacity-60">
        <Feather name="arrow-left" size={18} color={theme.text} />
      </Pressable>

      <Text className="mt-8 text-[34px] font-semibold leading-[44px] text-text" style={displayType}>
        Privacy
      </Text>
      <Text className="mt-1 text-xs font-semibold uppercase tracking-[1.2px] text-muted">
        Last updated 16 July 2026
      </Text>

      <PolicySection
        title="Local scanning"
        body="LanternScan listens for Bluetooth advertisements and probes devices reachable on your local Wi-Fi network. Device names, addresses, services, signal strength, and identification guesses are processed on your phone. LanternScan has no user accounts and includes no advertising or third-party analytics SDK in this release."
      />
      <PolicySection
        title="What stays on your phone"
        body="Your familiar or investigate choices, corrected device labels, onboarding state, and privacy preference are stored locally until you clear the app's data or uninstall it. Discovered-device sightings live in memory for the current app session."
      />
      <PolicySection
        title="Optional Fingerbank lookup"
        body="Online identification is off by default. If you explicitly enable it, LanternScan sends mDNS service names and, when available, hostnames and MAC addresses for devices it cannot identify locally to Fingerbank over HTTPS. Fingerbank states that submitted device data may be retained to improve its identification engine and is not associated with individual users. You can turn this off at any time in Settings."
      />
      <PolicySection
        title="Permissions"
        body="Bluetooth permission allows nearby-device discovery. Local Network permission on iOS allows Wi-Fi discovery. Android may describe Bluetooth and Wi-Fi scanning as location access; LanternScan does not request or read GPS coordinates. Network access is used only for local discovery and the optional Fingerbank lookup."
      />
      <PolicySection
        title="Questions and choices"
        body="Disable online identification in Settings to keep all scan processing on your phone. For privacy questions or deletion requests, use the developer support contact published with LanternScan's App Store or Google Play listing. Local app data can be deleted by uninstalling LanternScan or clearing its storage in system settings."
      />

      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Open Fingerbank privacy policy"
        onPress={openFingerbankPrivacy}
        className="mb-4 mt-8 flex-row items-center justify-center rounded-full border border-border bg-surface px-5 py-3.5 active:opacity-70">
        <Feather name="external-link" size={15} color={theme.primary} />
        <Text className="ml-2 text-sm font-bold text-text">Fingerbank privacy policy</Text>
      </Pressable>
    </Screen>
  );
}
