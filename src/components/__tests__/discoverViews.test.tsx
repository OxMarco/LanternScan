import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import LanternField from '@/components/LanternField';
import SonarListView from '@/components/SonarListView';
import ThemeProvider from '@/providers/ThemeProvider';
import type { DevicePresentation } from '@/scanner/present';

function bleDevice(overrides: Partial<DevicePresentation>): DevicePresentation {
  return {
    id: 'ble:test',
    transport: 'ble',
    category: 'speaker',
    title: 'AirPods Pro',
    named: true,
    subtitle: 'F4:0F:24:11:22:33',
    trust: 'known',
    lastSeenAt: Date.now(),
    distanceMeters: 1.2,
    distanceLabel: '~1.2 m',
    signalLabel: '-48 dBm',
    guesses: [],
    ...overrides,
  };
}

function renderedText(tree: ReactTestRenderer): string {
  return tree.root
    .findAllByType('Text' as never, { deep: true })
    .flatMap((node) => node.children)
    .filter((child): child is string => typeof child === 'string')
    .join(' ');
}

describe('LanternField', () => {
  it('places sighted devices on the field once measured', async () => {
    const devices = [
      bleDevice({ id: 'ble:near', title: 'AirPods Pro', distanceMeters: 0.8 }),
      bleDevice({ id: 'ble:room', title: 'Living Room TV', category: 'tv', distanceMeters: 3.4 }),
      bleDevice({ id: 'ble:far', title: 'Pixel Watch', category: 'wearable', distanceMeters: 9 }),
      bleDevice({
        id: 'ble:anon',
        title: 'Unknown Bluetooth device',
        named: false,
        category: 'unknown',
        distanceMeters: 1.1,
      }),
    ];

    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <ThemeProvider>
          <LanternField
            devices={devices}
            scanning={false}
            onToggleScan={() => {}}
            onSelect={() => {}}
          />
        </ThemeProvider>
      );
    });

    // The field only lays out lights after it has measured itself.
    const measurable = tree.root.findAll((node) => Boolean(node.props.onLayout));
    await act(async () => {
      measurable[0].props.onLayout({ nativeEvent: { layout: { width: 360, height: 520 } } });
    });

    const text = renderedText(tree);
    expect(text).toContain('AirPods Pro');
    expect(text).toContain('Living Room TV');
    expect(text).toContain('Pixel Watch');
    // Unnamed devices render as compact unlabelled points to keep the field calm.
    expect(text).not.toContain('Unknown Bluetooth device');
    expect(text).toContain('4 lights · tap one to inspect');

    await act(async () => tree.unmount());
  });

  it('invites a first scan when nothing has been sighted', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <ThemeProvider>
          <LanternField devices={[]} scanning={false} onToggleScan={() => {}} onSelect={() => {}} />
        </ThemeProvider>
      );
    });
    const measurable = tree.root.findAll((node) => Boolean(node.props.onLayout));
    await act(async () => {
      measurable[0].props.onLayout({ nativeEvent: { layout: { width: 360, height: 520 } } });
    });

    expect(renderedText(tree)).toContain('Tap the lantern to light up the room');

    await act(async () => tree.unmount());
  });
});

describe('SonarListView', () => {
  it('lists network devices under the pulse with no distance claims', async () => {
    const devices = [
      bleDevice({
        id: 'lan:router',
        transport: 'lan',
        title: 'Fritz!Box 7590',
        subtitle: '192.168.1.1',
        category: 'unknown',
        distanceMeters: undefined,
        distanceLabel: undefined,
        signalLabel: undefined,
      }),
      bleDevice({
        id: 'lan:printer',
        transport: 'lan',
        title: 'HP Envy 6000',
        subtitle: '192.168.1.55',
        category: 'unknown',
        trust: 'new',
        distanceMeters: undefined,
        distanceLabel: undefined,
        signalLabel: undefined,
      }),
    ];

    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <ThemeProvider>
          <SonarListView
            devices={devices}
            scanning={false}
            onToggleScan={() => {}}
            onSelect={() => {}}
          />
        </ThemeProvider>
      );
    });

    const text = renderedText(tree);
    expect(text).toContain('Fritz!Box 7590');
    expect(text).toContain('HP Envy 6000');
    expect(text).toContain('On your network');
    expect(text).toContain('not ranked by distance');
    // One new device on the network leads the headline.
    expect(text).toContain('1 new device found');

    await act(async () => tree.unmount());
  });
});
