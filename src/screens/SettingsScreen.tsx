import Feather from '@react-native-vector-icons/feather';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ComponentProps, ReactNode } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import Screen from '@/components/Screen';
import { usePersistedSetting } from '@/hooks/usePersistedSetting';
import { displayType } from '@/lib/typography';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { useAppTheme } from '@/providers/ThemeProvider';
import { getFingerbankApiKey } from '@/scanner/fingerprint/fingerbankConfig';
import { onlineIdentificationSetting } from '@/scanner/fingerprint/onlineIdentification';

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text className="mb-3 text-xs font-semibold uppercase tracking-[1.5px] text-muted">
      {children}
    </Text>
  );
}

function SettingRow({
  icon,
  title,
  description,
  control,
  divided = false,
}: {
  icon: ComponentProps<typeof Feather>['name'];
  title: string;
  description: string;
  control: ReactNode;
  divided?: boolean;
}) {
  const { theme } = useAppTheme();
  return (
    <View className={`flex-row items-center px-4 py-4 ${divided ? 'border-t border-border' : ''}`}>
      <View className="h-10 w-10 items-center justify-center rounded-2xl bg-primary/15">
        <Feather name={icon} size={17} color={theme.warning} />
      </View>
      <View className="ml-3 flex-1 pr-2" style={{ minWidth: 0 }}>
        <Text className="text-base font-semibold text-text">{title}</Text>
        <Text className="mt-0.5 text-sm leading-5 text-muted">{description}</Text>
      </View>
      {control}
    </View>
  );
}

function SettingToggle({
  label,
  value,
  disabled = false,
  onValueChange,
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { theme } = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onValueChange(!value)}
      className={`h-8 w-[52px] justify-center rounded-full p-1 active:opacity-70 ${
        value ? 'bg-primary' : 'bg-border'
      } ${disabled ? 'opacity-40' : ''}`}>
      <View
        className="h-6 w-6 rounded-full"
        style={{
          alignSelf: value ? 'flex-end' : 'flex-start',
          backgroundColor: value ? theme.primaryContrast : theme.muted,
        }}
      />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useAppTheme();
  const onlineIdentification = usePersistedSetting(onlineIdentificationSetting);
  const onlineIdentificationAvailable = Boolean(getFingerbankApiKey());

  const changeOnlineIdentification = (enabled: boolean) => {
    if (!onlineIdentificationAvailable) return;
    if (!enabled) {
      void onlineIdentification.setValue('disabled');
      return;
    }

    Alert.alert(
      'Share device signals?',
      'For devices it cannot identify locally, LanternScan will send service names and, when available, hostnames and MAC addresses to Fingerbank. Fingerbank may retain submitted device data to improve identification.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Enable',
          onPress: () => void onlineIdentification.setValue('enabled'),
        },
      ]
    );
  };

  return (
    <Screen scroll>
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to discovery"
          onPress={() => navigation.goBack()}
          className="h-11 w-11 items-center justify-center rounded-full border border-border bg-surface active:opacity-60">
          <Feather name="arrow-left" size={18} color={theme.text} />
        </Pressable>
      </View>

      <Text className="mt-8 text-[34px] font-semibold leading-[44px] text-text" style={displayType}>
        Settings
      </Text>
      <Text className="mt-2 max-w-[320px] text-base leading-6 text-muted">
        LanternScan stays useful without sharing anything.
      </Text>

      <View className="mt-9">
        <SectionLabel>Privacy</SectionLabel>
        <View className="overflow-hidden rounded-3xl border border-border bg-surface">
          <SettingRow
            icon="cloud"
            title="Online identification"
            description={
              onlineIdentificationAvailable
                ? 'Ask Fingerbank for better device matches'
                : 'Unavailable in this build'
            }
            control={
              <SettingToggle
                label="Online identification"
                value={onlineIdentification.value === 'enabled'}
                disabled={!onlineIdentificationAvailable}
                onValueChange={changeOnlineIdentification}
              />
            }
          />
          <SettingRow
            divided
            icon="file-text"
            title="Privacy policy"
            description="See what LanternScan accesses, stores, and shares"
            control={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open privacy policy"
                hitSlop={12}
                onPress={() => navigation.navigate('Privacy')}
                className="h-10 w-10 items-center justify-center rounded-full active:opacity-60">
                <Feather name="chevron-right" size={20} color={theme.muted} />
              </Pressable>
            }
          />
        </View>
      </View>

      <View className="mt-8 rounded-3xl bg-inverse px-5 py-5">
        <View className="flex-row items-center">
          <Feather name="lock" size={16} color={theme.primary} />
          <Text className="ml-2 text-sm font-semibold text-inverseText">Local by default</Text>
        </View>
        <Text className="mt-2 text-sm leading-5 text-inverseMuted">
          Scans, trust decisions, and corrected device labels stay on this phone.
        </Text>
      </View>
    </Screen>
  );
}
