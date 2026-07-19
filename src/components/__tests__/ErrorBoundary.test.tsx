import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

import ErrorBoundary from '@/components/ErrorBoundary';

function renderedText(tree: ReactTestRenderer): string {
  return tree.root
    .findAllByType('Text' as never, { deep: true })
    .flatMap((node) => node.children)
    .filter((child): child is string => typeof child === 'string')
    .join(' ');
}

describe('ErrorBoundary', () => {
  it('shows a soft error screen and remounts its children on retry', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    let shouldThrow = true;
    let tree!: ReactTestRenderer;

    function Child() {
      if (shouldThrow) throw new Error('render failed');
      return <Text>Recovered</Text>;
    }

    await act(async () => {
      tree = create(
        <ErrorBoundary context="test">
          <Child />
        </ErrorBoundary>
      );
    });

    expect(renderedText(tree)).toContain('LanternScan hit a snag');
    expect(renderedText(tree)).toContain('Your scan data is safe');

    shouldThrow = false;
    const retry = tree.root.findByProps({ accessibilityRole: 'button' });
    await act(async () => retry.props.onPress());

    expect(renderedText(tree)).toContain('Recovered');
    consoleError.mockRestore();
    await act(async () => tree.unmount());
  });
});
