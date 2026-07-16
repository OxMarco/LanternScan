import Feather from '@react-native-vector-icons/feather';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import LanternBackdrop from '@/components/LanternBackdrop';
import { useDevice } from '@/hooks/useDevice';
import { useLastSeenLabel } from '@/lib/timeAgo';
import { displayType, monoType } from '@/lib/typography';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { errorReporter } from '@/observability/observability';
import { useAppTheme } from '@/providers/ThemeProvider';
import { interrogateBleDevice } from '@/scanner/ble/gattInterrogate';
import { appearanceName } from '@/scanner/fingerprint/appearance';
import { appleModelName } from '@/scanner/fingerprint/appleModels';
import { companyName } from '@/scanner/fingerprint/companyIds';
import { removeCorrection, saveCorrection } from '@/scanner/fingerprint/corrections';
import { normalizeServiceUuid, serviceName } from '@/scanner/fingerprint/serviceUuids';
import { detectTracker } from '@/scanner/fingerprint/trackers';
import { describePorts } from '@/scanner/lan/portNames';
import { CATEGORY_ICON, presentDevice, TRUST_LABEL } from '@/scanner/present';
import { deviceRegistry } from '@/scanner/registry';
import { setTrust, useTrustLists } from '@/scanner/trustStore';

function SectionTitle({
  icon,
  label,
  busy = false,
}: {
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  busy?: boolean;
}) {
  const { theme } = useAppTheme();
  return (
    <View className="flex-row items-center">
      <Feather name={icon} size={16} color={theme.warning} />
      <Text className="ml-2.5 text-lg font-semibold text-text" style={displayType}>
        {label}
      </Text>
      {busy ? (
        <View className="ml-2">
          <ActivityIndicator size="small" color={theme.muted} />
        </View>
      ) : null}
    </View>
  );
}

function Detail({ label, value, divided }: { label: string; value: string; divided: boolean }) {
  const technical = /IP|MAC|port|server|service|firmware|hardware|software|serial|power/i.test(
    label
  );
  return (
    <View
      className={`flex-row items-center justify-between py-2.5 ${
        divided ? 'border-t border-border/60' : ''
      }`}>
      <Text className="text-sm text-muted">{label}</Text>
      <Text
        className="ml-4 flex-1 text-right text-sm font-medium leading-5 text-text"
        style={technical ? monoType : undefined}>
        {value}
      </Text>
    </View>
  );
}

function LastSeenBadge({ lastSeenAt }: { lastSeenAt: number }) {
  const lastSeen = useLastSeenLabel(lastSeenAt);

  return <Text className="text-xs font-medium text-inverseMuted">Seen {lastSeen}</Text>;
}

function HeroMetric({
  label,
  value,
  divided = false,
}: {
  label: string;
  value: string;
  divided?: boolean;
}) {
  return (
    <View className={`flex-1 px-3 ${divided ? 'border-l border-inverseText/10' : ''}`}>
      <Text className="text-[10px] font-semibold uppercase tracking-[1.4px] text-inverseMuted">
        {label}
      </Text>
      <Text className="mt-1 text-sm font-semibold text-inverseText" style={monoType}>
        {value}
      </Text>
    </View>
  );
}

function TrustAction({
  label,
  icon,
  tone,
  active,
  onPress,
}: {
  label: string;
  icon: ComponentProps<typeof Feather>['name'];
  tone: 'success' | 'error';
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();
  const activeClass = tone === 'success' ? 'bg-success/15' : 'bg-error/15';
  const activeTextClass = tone === 'success' ? 'text-success' : 'text-error';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`flex-1 flex-row items-center justify-center rounded-full px-3 py-3.5 active:opacity-80 ${
        active ? activeClass : 'border border-border/60 bg-surface'
      }`}>
      <Feather name={icon} size={15} color={active ? theme[tone] : theme.muted} />
      <Text className={`ml-2 text-sm font-bold ${active ? activeTextClass : 'text-text'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function DeviceDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'DeviceDetail'>>();
  const navigation = useNavigation();
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const device = useDevice(route.params.deviceId);
  const lists = useTrustLists();
  const [interrogating, setInterrogating] = useState(false);
  const [labelDraft, setLabelDraft] = useState<string | null>(null);
  const [identificationExpanded, setIdentificationExpanded] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [technicalExpanded, setTechnicalExpanded] = useState(false);
  const correctedLabel = labelDraft ?? device?.signals.userLabel ?? '';

  const onSetTrust = useCallback(
    (trust: 'whitelisted' | 'blacklisted' | 'none') => {
      void setTrust(route.params.deviceId, trust);
    },
    [route.params.deviceId]
  );

  // Opening the sheet is the intent to identify: connect once on mount and read
  // the device's own manufacturer/model/firmware. The read is best-effort — an
  // unreachable or bonding-only peripheral just leaves the advertised guesses in
  // place.
  const deviceId = route.params.deviceId;
  const interrogated = useRef(false);
  useEffect(() => {
    if (!deviceId.startsWith('ble:') || interrogated.current) return;
    interrogated.current = true;

    let active = true;
    setInterrogating(true);
    void interrogateBleDevice(deviceId)
      .then((info) => {
        if (!active) return;
        if (info) {
          deviceRegistry.report({ id: deviceId, transport: 'ble', signals: { gatt: info } });
        }
      })
      .catch((error) => {
        errorReporter.captureException(error, { context: 'ble-device-interrogation' });
      })
      .finally(() => {
        if (active) setInterrogating(false);
      });

    return () => {
      active = false;
    };
  }, [deviceId]);

  const onSaveLabel = useCallback(async () => {
    if (!device) return;
    const label = correctedLabel.replace(/\s+/g, ' ').trim();
    if (!label) return;
    await saveCorrection(device.signals, label);
    deviceRegistry.report({
      id: device.id,
      transport: device.transport,
      signals: { userLabel: label },
    });
  }, [correctedLabel, device]);

  const onClearLabel = useCallback(async () => {
    if (!device) return;
    await removeCorrection(device.signals);
    setLabelDraft('');
    deviceRegistry.report({
      id: device.id,
      transport: device.transport,
      signals: { userLabel: null },
    });
  }, [device]);

  if (!device) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-8">
        <View className="h-20 w-20 items-center justify-center rounded-[28px] bg-muted/15">
          <Feather name="cloud-off" size={28} color={theme.muted} />
        </View>
        <Text className="mt-5 text-center text-base text-muted">
          This device is no longer visible.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          className="mt-6 rounded-full bg-primary px-7 py-3.5 active:opacity-80">
          <Text className="text-base font-bold text-primaryContrast">Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const presentation = presentDevice(device, lists, deviceRegistry.isNew(device.id));
  const { signals } = device;
  const trustColor = {
    new: theme.warning,
    known: theme.inverseMuted,
    whitelisted: theme.success,
    blacklisted: theme.error,
  }[presentation.trust];

  // Manufacturer: a GATT-read name is ground truth, then the BLE company-ID
  // lookup, then a self-reported UPnP manufacturer, then the AP vendor for a
  // router, then a bare company ID we couldn't resolve to a name.
  const gatt = signals.gatt;
  const manufacturer =
    gatt?.manufacturer ??
    companyName(signals.manufacturerCompanyId) ??
    signals.ssdp?.manufacturer ??
    signals.apVendor ??
    (signals.manufacturerCompanyId !== undefined
      ? `Unknown vendor (ID 0x${signals.manufacturerCompanyId.toString(16)})`
      : undefined);

  // Model: a GATT-read model number, else UPnP model name, else the Bonjour
  // _device-info model (mapped to a marketing name when it's a known Apple id).
  const mdnsModel = signals.mdnsTxt?.model;
  const gattMarketingModel = gatt?.modelNumber ? appleModelName(gatt.modelNumber) : undefined;
  const model =
    (gatt?.modelNumber && gattMarketingModel
      ? `${gattMarketingModel} (${gatt.modelNumber.trim()})`
      : gatt?.modelNumber) ??
    signals.ssdp?.modelName ??
    (mdnsModel ? (appleModelName(mdnsModel) ?? mdnsModel) : undefined);

  // BLE advertised GATT services, resolved to human names where the Bluetooth SIG
  // dataset knows them (falling back to the short UUID).
  const bleServices = (signals.serviceUUIDs ?? []).map(
    (uuid) => serviceName(uuid) ?? normalizeServiceUuid(uuid)
  );

  // Any Bonjour TXT entries beyond the model we already surface above.
  const txtExtras = Object.entries(signals.mdnsTxt ?? {})
    .filter(([key]) => key !== 'model')
    .map(([key, value]) => `${key}=${value}`);

  // Advertisement-content tracker detection (AirGuard-derived patterns).
  const tracker = device.transport === 'ble' ? detectTracker(signals) : undefined;

  // Distance and signal get their own stat tiles below the hero.
  const overviewDetails: [string, string | undefined][] = [
    ['Type', device.transport === 'ble' ? 'Bluetooth LE' : 'Wi-Fi / LAN'],
    ['IP address', signals.ip],
    ['MAC', signals.mac],
    ['Hostname', signals.hostname],
    ['Manufacturer', manufacturer],
    ['Model', model],
    ['Operating system', signals.fingerbank?.os],
    ['Access point', signals.apVendor],
    ['Tracker', tracker?.label],
  ];
  const technicalDetails: [string, string | undefined][] = [
    ['UPnP name', signals.ssdp?.friendlyName],
    ['Firmware', gatt?.firmware],
    ['Hardware', gatt?.hardware],
    ['Software', gatt?.software],
    ['Serial number', gatt?.serialNumber],
    ['Appearance', appearanceName(signals.appearance)],
    ['Web server', signals.httpServer ?? signals.ssdp?.server],
    ['Tx power', signals.txPower !== undefined ? `${signals.txPower} dBm` : undefined],
    ['BLE services', bleServices.length ? bleServices.join(', ') : undefined],
    [
      'Network services',
      signals.mdnsServices?.length ? signals.mdnsServices.join(', ') : undefined,
    ],
    ['Open ports', signals.openPorts?.length ? describePorts(signals.openPorts) : undefined],
    ['Bonjour info', txtExtras.length ? txtExtras.join('  ·  ') : undefined],
  ];
  const visibleOverviewDetails = overviewDetails.filter((entry): entry is [string, string] =>
    Boolean(entry[1])
  );
  const visibleTechnicalDetails = technicalDetails.filter((entry): entry is [string, string] =>
    Boolean(entry[1])
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <LanternBackdrop />
      <ScrollView
        contentContainerClassName="px-5 pb-12 pt-4"
        contentContainerStyle={{
          width: '100%',
          maxWidth: 680,
          alignSelf: 'center',
          boxSizing: 'border-box',
        }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to discovery"
          onPress={() => navigation.goBack()}
          className="mb-8 h-11 w-11 items-center justify-center rounded-full border border-border bg-surface active:opacity-60">
          <Feather name="arrow-left" size={18} color={theme.text} />
        </Pressable>

        <View
          className="overflow-hidden rounded-[34px] border border-primary/10 bg-inverse px-5 pb-5 pt-5"
          style={{
            shadowColor: theme.primary,
            shadowOpacity: 0.07,
            shadowRadius: 30,
            shadowOffset: { width: 0, height: 14 },
            elevation: 4,
          }}>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: 220,
              height: 220,
              borderRadius: 110,
              right: -90,
              top: -72,
              backgroundColor: theme.primary,
              opacity: 0.05,
            }}
          />
          <View className="flex-row items-center justify-between">
            <View
              className="flex-row items-center rounded-full px-3 py-1.5"
              style={{ borderWidth: 1, borderColor: trustColor }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: trustColor }} />
              <Text className="ml-2 text-xs font-semibold" style={{ color: trustColor }}>
                {TRUST_LABEL[presentation.trust]}
              </Text>
            </View>
            <LastSeenBadge lastSeenAt={device.lastSeenAt} />
          </View>

          <View className="mt-7 flex-row items-center">
            <View
              className="items-center justify-center rounded-[26px] border border-primary/30 bg-primary/10"
              style={{ width: compact ? 64 : 80, height: compact ? 64 : 80 }}>
              <Feather
                name={CATEGORY_ICON[presentation.category]}
                size={compact ? 26 : 31}
                color={theme.primary}
              />
            </View>
            <View className="ml-4 flex-1" style={{ minWidth: 0 }}>
              <Text
                className="font-semibold text-inverseText"
                style={[
                  displayType,
                  { fontSize: compact ? 24 : 30, lineHeight: compact ? 29 : 36 },
                ]}
                numberOfLines={2}>
                {presentation.title}
              </Text>
              {presentation.guesses[0] && presentation.guesses[0].label !== presentation.title ? (
                <Text className="mt-1 text-sm text-inverseMuted" numberOfLines={1}>
                  Likely {presentation.guesses[0].label}
                </Text>
              ) : (
                <Text className="mt-1 text-sm text-inverseMuted">
                  {device.transport === 'ble' ? 'Bluetooth LE device' : 'Wi-Fi / LAN device'}
                </Text>
              )}
            </View>
          </View>

          <View
            className="mt-6 flex-row border-t pt-4"
            style={{ borderColor: 'rgba(248, 244, 233, 0.1)' }}>
            <HeroMetric label="Transport" value={device.transport === 'ble' ? 'BLE' : 'Wi-Fi'} />
            {presentation.distanceLabel ? (
              <HeroMetric divided label="Distance" value={presentation.distanceLabel} />
            ) : null}
            {presentation.signalLabel ? (
              <HeroMetric divided label="Signal" value={presentation.signalLabel} />
            ) : null}
          </View>
        </View>

        <View className="mt-8 border-t border-border pt-6">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: identificationExpanded }}
            onPress={() => setIdentificationExpanded((expanded) => !expanded)}
            className="flex-row items-center active:opacity-60">
            <View className="flex-1">
              <SectionTitle icon="search" label="Identification" />
            </View>
            <Feather
              name={identificationExpanded ? 'chevron-up' : 'chevron-down'}
              size={19}
              color={theme.muted}
            />
          </Pressable>
          {presentation.guesses.length === 0 ? (
            <Text className="mt-3 text-sm leading-5 text-muted">
              Not enough signals to identify this device yet
            </Text>
          ) : identificationExpanded ? (
            <View className="mt-3">
              {presentation.guesses.map((guess, index) => (
                <View
                  key={guess.label}
                  className={`py-3 ${index > 0 ? 'border-t border-border' : ''}`}>
                  <View className="flex-row items-baseline justify-between">
                    <Text className="flex-1 text-base font-semibold text-text" numberOfLines={1}>
                      {guess.label}
                    </Text>
                    <Text className="ml-3 text-sm text-muted" style={monoType}>
                      {Math.round(guess.confidence * 100)}%
                    </Text>
                  </View>
                  <Text className="mt-1 text-sm leading-5 text-muted">{guess.reason}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text className="mt-3 text-sm text-muted">
              {presentation.guesses.length} identification signal
              {presentation.guesses.length === 1 ? '' : 's'} available
            </Text>
          )}
        </View>

        <View className="mt-8 border-t border-border pt-6">
          <SectionTitle icon="info" label="Overview" busy={interrogating} />
          <View className="mt-2">
            {visibleOverviewDetails.map(([label, value], index) => (
              <Detail key={label} label={label} value={value} divided={index > 0} />
            ))}
          </View>
        </View>

        <View className="mt-8 border-t border-border pt-6">
          <SectionTitle icon="shield" label="Review status" />
          <Text className="mt-3 text-sm leading-5 text-muted">
            Keep familiar devices quiet and flag anything unusual. LanternScan never blocks devices or
            changes your network.
          </Text>
          <View className="mt-4 flex-row gap-3">
            <TrustAction
              label="Familiar"
              icon="check-circle"
              tone="success"
              active={presentation.trust === 'whitelisted'}
              onPress={() =>
                onSetTrust(presentation.trust === 'whitelisted' ? 'none' : 'whitelisted')
              }
            />
            <TrustAction
              label="Investigate"
              icon="flag"
              tone="error"
              active={presentation.trust === 'blacklisted'}
              onPress={() =>
                onSetTrust(presentation.trust === 'blacklisted' ? 'none' : 'blacklisted')
              }
            />
          </View>
        </View>

        <View className="mt-8 border-t border-border pt-6">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: editingLabel }}
            onPress={() => setEditingLabel((editing) => !editing)}
            className="flex-row items-center active:opacity-60">
            <View className="flex-1">
              <SectionTitle icon="edit-3" label="Correct identification" />
            </View>
            <Feather
              name={editingLabel ? 'chevron-up' : 'chevron-down'}
              size={19}
              color={theme.muted}
            />
          </Pressable>
          {editingLabel ? (
            <>
              <Text className="mt-3 text-sm leading-5 text-muted">
                Save the real model to match fingerprints on this phone
              </Text>
              <TextInput
                accessibilityLabel="Correct device identification"
                autoCapitalize="words"
                autoCorrect={false}
                value={correctedLabel}
                onChangeText={setLabelDraft}
                placeholder="e.g. Sonos Era 100"
                placeholderTextColor={theme.muted}
                className="mt-4 rounded-2xl border border-border bg-surface px-4 py-3.5 text-base text-text"
              />
              <View className="mt-3 flex-row gap-3">
                <Pressable
                  accessibilityRole="button"
                  disabled={!correctedLabel.trim()}
                  onPress={() => void onSaveLabel()}
                  className={`flex-1 items-center rounded-full bg-primary px-4 py-3.5 active:opacity-80 ${
                    correctedLabel.trim() ? '' : 'opacity-50'
                  }`}>
                  <Text className="text-sm font-bold text-primaryContrast">Save label</Text>
                </Pressable>
                {signals.userLabel ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void onClearLabel()}
                    className="items-center rounded-full border border-border px-5 py-3.5 active:opacity-70">
                    <Text className="text-sm font-bold text-muted">Clear</Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          ) : (
            <Text className="mt-3 text-sm text-muted">
              Teach LanternScan the device&apos;s real name
            </Text>
          )}
        </View>

        {visibleTechnicalDetails.length > 0 ? (
          <View className="mt-8 border-t border-border pt-6">
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: technicalExpanded }}
              onPress={() => setTechnicalExpanded((expanded) => !expanded)}
              className="flex-row items-center active:opacity-70">
              <View className="flex-1">
                <SectionTitle icon="activity" label="Technical details" />
              </View>
              <Feather
                name={technicalExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={theme.muted}
              />
            </Pressable>
            <Text className="mt-3 text-sm leading-5 text-muted">
              Raw discovery signals used to identify this device
            </Text>
            {technicalExpanded ? (
              <View className="mt-2">
                {visibleTechnicalDetails.map(([label, value], index) => (
                  <Detail key={label} label={label} value={value} divided={index > 0} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
