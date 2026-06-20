import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createInactivityTimer } from './inactivityTimer';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createInactivityTimer', () => {
  test('calls onTimeout after the given duration with no resets', () => {
    const onTimeout = vi.fn();
    const timer = createInactivityTimer(1000, onTimeout);
    timer.reset();

    vi.advanceTimersByTime(999);
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  test('resetting before expiry pushes the deadline back', () => {
    const onTimeout = vi.fn();
    const timer = createInactivityTimer(1000, onTimeout);
    timer.reset();

    vi.advanceTimersByTime(900);
    timer.reset();
    vi.advanceTimersByTime(900);
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  test('clear() prevents onTimeout from firing', () => {
    const onTimeout = vi.fn();
    const timer = createInactivityTimer(1000, onTimeout);
    timer.reset();
    timer.clear();

    vi.advanceTimersByTime(2000);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
