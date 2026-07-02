import { act, renderHook } from '@testing-library/react-native';

import { useDebouncedValue } from '@/features/friends/useDebouncedValue';

/** Awaited act wrapper: React 19 act() is a thenable. */
async function advance(ms: number): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

describe('useDebouncedValue (300 ms search debounce)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('holds the previous value until the delay elapses', async () => {
    const { result, rerender } = await renderHook(
      (props: { v: string }) => useDebouncedValue(props.v, 300),
      { initialProps: { v: 'ri' } },
    );
    expect(result.current).toBe('ri');

    await rerender({ v: 'rit' });
    expect(result.current).toBe('ri');

    await advance(299);
    expect(result.current).toBe('ri');

    await advance(1);
    expect(result.current).toBe('rit');
  });

  test('rapid typing: only the LAST value lands (timer resets each change)', async () => {
    const { result, rerender } = await renderHook(
      (props: { v: string }) => useDebouncedValue(props.v, 300),
      { initialProps: { v: 'r' } },
    );

    await rerender({ v: 'ri' });
    await advance(150);
    await rerender({ v: 'rit' });
    await advance(150);
    // 300 ms since the FIRST change, but only 150 since the last → still 'r'.
    expect(result.current).toBe('r');

    await advance(150);
    expect(result.current).toBe('rit');
  });
});
