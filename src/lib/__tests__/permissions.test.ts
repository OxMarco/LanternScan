import { Platform } from 'react-native';
import type { BleManager, State } from 'react-native-ble-plx';

import { requestBluetoothPermission } from '@/lib/permissions';
import { getBleManager } from '@/scanner/ble/bleManager';

jest.mock('@/scanner/ble/bleManager', () => ({ getBleManager: jest.fn() }));

const mockedGetBleManager = jest.mocked(getBleManager);

// Stand-in for the shared BleManager: records the state listener so a test can
// drive the adapter through the states iOS reports while the authorization
// dialog is up and after the user answers it.
function fakeBleManager() {
  const remove = jest.fn();
  let listener: ((state: State) => void) | undefined;
  const manager = {
    onStateChange: jest.fn((callback: (state: State) => void, emitCurrentState?: boolean) => {
      listener = callback;
      // iOS sits in 'Unknown' until authorization resolves, so that is what the
      // initial emit reports on a first run.
      if (emitCurrentState) callback('Unknown' as State);
      return { remove };
    }),
  };
  return {
    manager: manager as unknown as BleManager,
    remove,
    emit: (state: string) => listener?.(state as State),
  };
}

const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

describe('requestBluetoothPermission on iOS', () => {
  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('waits for the user to answer instead of resolving while the dialog is up', async () => {
    const { manager, emit } = fakeBleManager();
    mockedGetBleManager.mockReturnValue(manager);

    const settled = jest.fn();
    void requestBluetoothPermission().then(settled);
    await flushMicrotasks();

    // The prompt is on screen: the adapter is still 'Unknown' and onboarding
    // must not march on and claim the permission was granted.
    expect(settled).not.toHaveBeenCalled();

    emit('PoweredOn');
    await flushMicrotasks();
    expect(settled).toHaveBeenCalledWith('granted');
  });

  it('reports denied when the user refuses', async () => {
    const { manager, emit, remove } = fakeBleManager();
    mockedGetBleManager.mockReturnValue(manager);

    const outcome = requestBluetoothPermission();
    emit('Unauthorized');

    await expect(outcome).resolves.toBe('denied');
    expect(remove).toHaveBeenCalled();
  });

  it('treats a powered-off radio as an answered prompt', async () => {
    const { manager, emit } = fakeBleManager();
    mockedGetBleManager.mockReturnValue(manager);

    const outcome = requestBluetoothPermission();
    emit('PoweredOff');

    await expect(outcome).resolves.toBe('granted');
  });

  it('reports unavailable when Bluetooth is unsupported or the native module is missing', async () => {
    const { manager, emit } = fakeBleManager();
    mockedGetBleManager.mockReturnValue(manager);
    const unsupported = requestBluetoothPermission();
    emit('Unsupported');
    await expect(unsupported).resolves.toBe('unavailable');

    mockedGetBleManager.mockReturnValue(null);
    await expect(requestBluetoothPermission()).resolves.toBe('unavailable');
  });
});
