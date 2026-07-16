import Feather from '@react-native-vector-icons/feather';
import type { ComponentProps } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PrimaryButton from '@/components/PrimaryButton';
import LanternBackdrop from '@/components/LanternBackdrop';
import { displayType } from '@/lib/typography';
import { useAppTheme } from '@/providers/ThemeProvider';

type Props = {
  icon: ComponentProps<typeof Feather>['name'];
  title: string;
  body: string;
  stepIndex: number;
  stepCount: number;
  busy: boolean;
  onContinue: () => void;
};

// One onboarding step: a full-screen rationale for a single permission, with a
// lone Continue button that fires the OS prompt. The flow never dead-ends on a
// denied permission — the caller always moves forward with the outcome.
export default function PermissionStep({
  icon,
  title,
  body,
  stepIndex,
  stepCount,
  busy,
  onContinue,
}: Props) {
  const { theme } = useAppTheme();
  const { height, width } = useWindowDimensions();
  const compact = height < 650 || width < 360;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <LanternBackdrop />
      <ScrollView
        bounces={false}
        contentContainerStyle={{ flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center' }}
        showsVerticalScrollIndicator={false}>
        <View
          className="flex-1 items-center justify-center px-8"
          style={{ paddingBottom: compact ? 20 : 32, paddingTop: compact ? 20 : 0 }}>
          <View
            className="items-center justify-center rounded-full border border-primary/20 bg-primary/[0.03]"
            style={{
              width: compact ? 104 : 128,
              height: compact ? 104 : 128,
              shadowColor: theme.primary,
              shadowOpacity: 0.12,
              shadowRadius: 30,
              shadowOffset: { width: 0, height: 0 },
            }}>
            <View
              className="items-center justify-center rounded-[30px] border border-border bg-surface"
              style={{ width: compact ? 78 : 96, height: compact ? 78 : 96 }}>
              <Feather name={icon} size={compact ? 29 : 34} color={theme.primary} />
            </View>
          </View>
          <Text
            className="text-xs font-semibold uppercase tracking-[2px] text-muted"
            style={{ marginTop: compact ? 20 : 32 }}>
            Step {stepIndex + 1} of {stepCount}
          </Text>
          <Text
            className="mt-3 max-w-[330px] text-center font-semibold text-text"
            style={[displayType, { fontSize: compact ? 30 : 34, lineHeight: compact ? 36 : 40 }]}>
            {title}
          </Text>
          <Text className="mt-4 max-w-[340px] text-center text-base leading-6 text-muted">
            {body}
          </Text>
        </View>

        <View className="px-6 pb-6">
          {stepCount > 1 ? (
            <View className="mb-5 flex-row justify-center gap-2">
              {Array.from({ length: stepCount }, (_, index) => (
                <View
                  key={index}
                  className={`h-2 rounded-full ${
                    index === stepIndex ? 'w-6 bg-primary' : 'w-2 bg-border'
                  }`}
                />
              ))}
            </View>
          ) : null}
          <PrimaryButton label="Continue" loading={busy} onPress={onContinue} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
