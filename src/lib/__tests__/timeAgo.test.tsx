import { act, create } from 'react-test-renderer';

import { useLastSeenLabel } from '@/lib/timeAgo';

function LastSeen({ at }: { at: number }) {
  return <>{`Last seen ${useLastSeenLabel(at)}`}</>;
}

function labelFor(millisecondsAgo: number): string {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<LastSeen at={Date.now() - millisecondsAgo} />);
  });
  const label = tree.toJSON() as unknown as string;
  // The label refreshes itself on a timer; unmount so it stops ticking once read.
  act(() => tree.unmount());
  return label;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe('useLastSeenLabel', () => {
  it.each([
    [5_000, 'Last seen just now'],
    [MINUTE, 'Last seen 1 minute ago'],
    [2 * HOUR, 'Last seen 2 hours ago'],
    [26 * HOUR, 'Last seen 1 day ago'],
  ])('formats a sighting %ims old', (ago, expected) => {
    expect(labelFor(ago)).toBe(expected);
  });
});
