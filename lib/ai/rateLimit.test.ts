import { beforeEach, describe, expect, test } from 'vitest';
import { _resetRateLimitForTests, checkRateLimit } from './rateLimit';

beforeEach(() => {
  _resetRateLimitForTests();
});

describe('checkRateLimit', () => {
  test('allows requests up to the limit within a window', () => {
    const now = 0;
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit('1.2.3.4', now).allowed).toBe(true);
    }
  });

  test('blocks the 11th request within the same window', () => {
    const now = 0;
    for (let i = 0; i < 10; i++) checkRateLimit('1.2.3.4', now);
    const result = checkRateLimit('1.2.3.4', now);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  test('resets once the window has elapsed', () => {
    let now = 0;
    for (let i = 0; i < 10; i++) checkRateLimit('1.2.3.4', now);
    now += 60_001;
    expect(checkRateLimit('1.2.3.4', now).allowed).toBe(true);
  });

  test('tracks each IP independently', () => {
    const now = 0;
    for (let i = 0; i < 10; i++) checkRateLimit('1.2.3.4', now);
    expect(checkRateLimit('5.6.7.8', now).allowed).toBe(true);
  });
});
