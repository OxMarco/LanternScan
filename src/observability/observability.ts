import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { DEFAULT_ANALYTICS_CONSENT, type AnalyticsConsent } from './analyticsConsent';
import type {
  AnalyticsAdapter,
  AnalyticsEventMap,
  ErrorContext,
  ErrorReporterAdapter,
  TelemetryProperties,
  TelemetryValue,
} from './types';

const SENSITIVE_PROPERTY = /authorization|cookie|password|secret|token|email|phone|address/i;

const noopAnalytics: AnalyticsAdapter = {
  track: () => undefined,
};

const noopErrorReporter: ErrorReporterAdapter = {
  captureException: () => undefined,
};

let analyticsAdapter: AnalyticsAdapter = noopAnalytics;
let errorAdapter: ErrorReporterAdapter = noopErrorReporter;
let analyticsConsent: AnalyticsConsent = DEFAULT_ANALYTICS_CONSENT;

export function configureObservability(adapters: {
  analytics?: AnalyticsAdapter;
  errors?: ErrorReporterAdapter;
}) {
  if (adapters.analytics) analyticsAdapter = adapters.analytics;
  if (adapters.errors) errorAdapter = adapters.errors;
}

export function resetObservabilityConfiguration() {
  analyticsAdapter = noopAnalytics;
  errorAdapter = noopErrorReporter;
  analyticsConsent = DEFAULT_ANALYTICS_CONSENT;
}

export const analytics = {
  setConsent(consent: AnalyticsConsent) {
    const wasGranted = analyticsConsent === 'granted';
    analyticsConsent = consent;
    if (wasGranted && consent !== 'granted') safelyInvoke(() => analyticsAdapter.reset?.());
  },
  track<EventName extends keyof AnalyticsEventMap>(
    event: EventName,
    properties: AnalyticsEventMap[EventName]
  ) {
    if (analyticsConsent !== 'granted') return;
    sendAnalyticsEvent(event, sanitizeProperties(properties as TelemetryProperties));
  },
  screen(screen: string) {
    analytics.track('screen_viewed', { screen });
  },
  identify(userId: string, traits: TelemetryProperties = {}) {
    if (analyticsConsent !== 'granted' || !userId) return;
    safelyInvoke(() => analyticsAdapter.identify?.(userId, sanitizeProperties(traits)));
  },
  reset() {
    safelyInvoke(() => analyticsAdapter.reset?.());
  },
  flush() {
    if (analyticsConsent !== 'granted') return;
    safelyInvoke(() => analyticsAdapter.flush?.());
  },
};

export const errorReporter = {
  captureException(error: unknown, context?: ErrorContext) {
    safelyInvoke(() => errorAdapter.captureException(error, enrichErrorContext(context)));
  },
  captureMessage(message: string, context?: ErrorContext) {
    safelyInvoke(() => errorAdapter.captureMessage?.(message, enrichErrorContext(context)));
  },
  addBreadcrumb(message: string, properties: TelemetryProperties = {}) {
    safelyInvoke(() => errorAdapter.addBreadcrumb?.(message, sanitizeProperties(properties)));
  },
  setUser(user: { id: string } | null) {
    safelyInvoke(() => errorAdapter.setUser?.(user));
  },
};

export function sanitizeProperties(properties: TelemetryProperties): TelemetryProperties {
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [
      key,
      SENSITIVE_PROPERTY.test(key) ? '[REDACTED]' : sanitizeValue(key, value),
    ])
  );
}

function commonProperties(): TelemetryProperties {
  return {
    platform: Platform.OS,
    app_version: Constants.expoConfig?.version ?? 'unknown',
    build_version: nativeBuildVersion(),
    locale: currentLocale(),
    environment: __DEV__ ? 'development' : 'production',
    session_id: Constants.sessionId,
  };
}

function sendAnalyticsEvent(event: string, properties: TelemetryProperties) {
  safelyInvoke(() =>
    analyticsAdapter.track(event, {
      ...properties,
      ...commonProperties(),
    })
  );
}

function nativeBuildVersion(): string {
  if (Platform.OS === 'ios') return Constants.platform?.ios?.buildNumber ?? 'unknown';
  if (Platform.OS === 'android') {
    return String(Constants.platform?.android?.versionCode ?? 'unknown');
  }
  return 'web';
}

function currentLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'unknown';
  } catch {
    return 'unknown';
  }
}

function enrichErrorContext(context?: ErrorContext): ErrorContext {
  const common = commonProperties();
  return {
    context: context?.context,
    tags: context?.tags
      ? Object.fromEntries(
          Object.entries({
            ...context.tags,
            platform: String(common.platform),
            app_version: String(common.app_version),
            build_version: String(common.build_version),
            environment: String(common.environment),
          }).map(([key, value]) => [key, SENSITIVE_PROPERTY.test(key) ? '[REDACTED]' : value])
        )
      : {
          platform: String(common.platform),
          app_version: String(common.app_version),
          build_version: String(common.build_version),
          environment: String(common.environment),
        },
    extra: sanitizeProperties({
      ...context?.extra,
      locale: common.locale,
      session_id: common.session_id,
    }),
  };
}

function sanitizeValue(key: string, value: TelemetryValue): TelemetryValue {
  if (typeof value !== 'string') return value;
  return value.slice(0, key === 'component_stack' ? 2000 : 200);
}

function safelyInvoke(operation: () => void | Promise<void> | undefined) {
  try {
    const result = operation();
    if (result) void result.catch(() => undefined);
  } catch {
    // Observability must never crash or alter application behavior.
  }
}
