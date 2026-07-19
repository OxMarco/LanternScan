import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import LanternBackdrop from './LanternBackdrop';

type Props = {
  children: ReactNode;
  scroll?: boolean;
};

export default function Screen({ children, scroll = false }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'right', 'bottom', 'left']}>
      <LanternBackdrop />
      {scroll ? (
        <ScrollView
          contentContainerClassName="grow px-5 pb-8 pt-4"
          contentContainerStyle={{
            width: '100%',
            maxWidth: 680,
            alignSelf: 'center',
            boxSizing: 'border-box',
          }}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View className="w-full flex-1 self-center px-5 pb-8 pt-4" style={{ maxWidth: 680 }}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
