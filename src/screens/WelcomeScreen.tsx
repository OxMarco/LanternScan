import Feather from '@react-native-vector-icons/feather';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Platform, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import LanternBackdrop from '@/components/LanternBackdrop';
import PrimaryButton from '@/components/PrimaryButton';
import { displayType } from '@/lib/typography';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { analytics } from '@/observability/observability';
import { useAppTheme } from '@/providers/ThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  const { theme } = useAppTheme();
  const { height, width } = useWindowDimensions();
  const compact = height < 700 || width < 360;
  const onGetStarted = () => {
    analytics.track('onboarding_started', { source: 'welcome' });
    // Android grants LAN access at install time, so its rationale step only
    // exists on iOS.
    if (Platform.OS === 'ios') navigation.navigate('LocalNetworkPermission');
    else navigation.navigate('BluetoothPermission', { localNetwork: 'granted' });
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <LanternBackdrop />
      <ScrollView
        bounces={false}
        contentContainerStyle={{ flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center' }}
        showsVerticalScrollIndicator={false}>
        <View className="flex-1 px-6 pt-5">
          <View className="flex-row items-center">
            <MaterialCommunityIcons name="spotlight-beam" size={34} color={theme.primary} />
            <Text
              className="ml-3 text-base font-semibold tracking-[2px] text-text"
              style={displayType}>
              LANTERN
            </Text>
          </View>

          <View
            className="flex-1 items-center justify-center"
            style={{ paddingBottom: compact ? 16 : 28, paddingTop: compact ? 16 : 20 }}>
            <View
              className="w-full max-w-[360px] items-center justify-center overflow-hidden rounded-[36px] border border-primary/10 bg-inverse"
              style={{
                height: compact ? 190 : 288,
                shadowColor: theme.primary,
                shadowOpacity: 0.09,
                shadowRadius: 34,
                shadowOffset: { width: 0, height: 16 },
                elevation: 5,
              }}>
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  width: 230,
                  height: 90,
                  borderRadius: 115,
                  top: -72,
                  backgroundColor: theme.primary,
                  opacity: 0.11,
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  width: 230,
                  height: 230,
                  borderRadius: 115,
                  borderWidth: 1,
                  borderColor: 'rgba(248, 244, 233, 0.08)',
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  width: 154,
                  height: 154,
                  borderRadius: 77,
                  backgroundColor: theme.primary,
                  opacity: 0.08,
                }}
              />

              <View
                accessibilityElementsHidden
                className="absolute left-7 top-12 h-11 w-11 items-center justify-center rounded-2xl border border-inverseMuted/40 bg-inverseText/10">
                <Feather name="smartphone" size={17} color={theme.inverseText} />
                <View className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-inverse bg-success" />
              </View>
              <View
                accessibilityElementsHidden
                className="absolute right-7 top-20 h-11 w-11 items-center justify-center rounded-2xl border border-inverseMuted/40 bg-inverseText/10">
                <Feather name="speaker" size={17} color={theme.inverseText} />
                <View className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-inverse bg-warning" />
              </View>
              <View
                accessibilityElementsHidden
                className="absolute bottom-10 left-12 h-11 w-11 items-center justify-center rounded-2xl border border-inverseMuted/40 bg-inverseText/10">
                <Feather name="monitor" size={17} color={theme.inverseText} />
                <View className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-inverse bg-primary" />
              </View>

              <View className="h-32 w-32 items-center justify-center rounded-full bg-primary/10">
                <MaterialCommunityIcons name="spotlight-beam" size={72} color={theme.primary} />
              </View>
            </View>
            <Text
              className="max-w-[340px] text-center font-semibold text-text"
              style={[
                displayType,
                {
                  marginTop: compact ? 16 : 32,
                  fontSize: compact ? 32 : 38,
                  lineHeight: compact ? 38 : 44,
                },
              ]}>
              Know what&apos;s around you
            </Text>
            <Text
              className="max-w-[320px] text-center text-base leading-6 text-muted"
              style={{ marginTop: compact ? 10 : 16 }}>
              See the devices sharing your Wi-Fi and broadcasting nearby, without sending a scan
              anywhere else.
            </Text>
          </View>
        </View>

        <View className="px-6 pb-6">
          <PrimaryButton label="Scan my network" onPress={onGetStarted} />
          <Text className="mt-4 text-center text-xs leading-5 text-muted">
            Private by default. Online identification stays off until you enable it.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
