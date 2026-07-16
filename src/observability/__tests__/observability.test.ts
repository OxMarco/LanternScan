import {
  analytics,
  configureObservability,
  errorReporter,
  resetObservabilityConfiguration,
  sanitizeProperties,
} from '../observability';

describe('observability', () => {
  afterEach(() => {
    resetObservabilityConfiguration();
  });

  it('does not send analytics before the user explicitly opts in', () => {
    const track = jest.fn();
    configureObservability({ analytics: { track } });

    analytics.track('app_launched', { launch: 'cold' });
    expect(track).not.toHaveBeenCalled();

    analytics.setConsent('granted');
    analytics.track('app_launched', { launch: 'cold' });
    expect(track).toHaveBeenCalledWith(
      'app_launched',
      expect.objectContaining({ launch: 'cold', platform: expect.any(String) })
    );
  });

  it('stops sending analytics once consent is denied', () => {
    const track = jest.fn();
    configureObservability({ analytics: { track } });
    analytics.setConsent('denied');

    analytics.track('app_launched', { launch: 'cold' });
    expect(track).not.toHaveBeenCalled();

    analytics.setConsent('granted');
    analytics.track('app_launched', { launch: 'cold' });
    expect(track).toHaveBeenCalledWith(
      'app_launched',
      expect.objectContaining({ launch: 'cold', platform: expect.any(String) })
    );
  });

  it('resets the analytics identity when consent is withdrawn', () => {
    const reset = jest.fn();
    configureObservability({ analytics: { track: jest.fn(), reset } });

    analytics.setConsent('granted');
    analytics.setConsent('denied');
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('redacts sensitive telemetry properties', () => {
    expect(sanitizeProperties({ auth_token: 'secret', operation: 'list_items', count: 2 })).toEqual(
      { auth_token: '[REDACTED]', operation: 'list_items', count: 2 }
    );
  });

  it('keeps adapter failures from changing application behavior', () => {
    configureObservability({
      analytics: {
        track: () => {
          throw new Error('analytics unavailable');
        },
      },
      errors: {
        captureException: () => {
          throw new Error('reporter unavailable');
        },
      },
    });
    analytics.setConsent('granted');

    expect(() => analytics.track('app_launched', { launch: 'cold' })).not.toThrow();
    expect(() => errorReporter.captureException(new Error('app failure'))).not.toThrow();
  });
});
