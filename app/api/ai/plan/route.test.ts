import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { _resetRateLimitForTests } from '@/lib/ai/rateLimit';

const { callPlannerModelMock } = vi.hoisted(() => ({ callPlannerModelMock: vi.fn() }));
vi.mock('@/lib/ai/anthropicClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/anthropicClient')>('@/lib/ai/anthropicClient');
  return { ...actual, callPlannerModel: callPlannerModelMock };
});

import { POST } from './route';

function makeRequest(body: unknown, ip = '9.9.9.9'): NextRequest {
  return new NextRequest('http://localhost/api/ai/plan', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const minimalContext = { periodStart: 0, periodEnd: 1, categorySummaries: [], budgets: [], goals: [] };

beforeEach(() => {
  _resetRateLimitForTests();
  callPlannerModelMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/ai/plan', () => {
  test('returns the parsed planner response on success', async () => {
    callPlannerModelMock.mockResolvedValue(JSON.stringify({ message: 'Looking good!' }));

    const res = await POST(makeRequest({ context: minimalContext, message: 'how am I doing?', history: [] }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ message: 'Looking good!', proposedPlan: undefined });
  });

  test('returns 429 once the per-IP rate limit is exceeded', async () => {
    callPlannerModelMock.mockResolvedValue(JSON.stringify({ message: 'ok' }));
    for (let i = 0; i < 10; i++) {
      await POST(makeRequest({ context: minimalContext, message: 'hi', history: [] }, '1.1.1.1'));
    }
    const res = await POST(makeRequest({ context: minimalContext, message: 'hi', history: [] }, '1.1.1.1'));
    expect(res.status).toBe(429);
  });

  test('returns 500 with a safe message when the API key is missing', async () => {
    const { AnthropicConfigError } = await import('@/lib/ai/anthropicClient');
    callPlannerModelMock.mockRejectedValue(new AnthropicConfigError('missing'));

    const res = await POST(makeRequest({ context: minimalContext, message: 'hi', history: [] }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.message).toBe('AI planner is unavailable right now.');
  });

  test('returns 502 with a friendly message on any other Anthropic error', async () => {
    callPlannerModelMock.mockRejectedValue(new Error('boom'));

    const res = await POST(makeRequest({ context: minimalContext, message: 'hi', history: [] }));
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.message).toBe('Something went wrong — try again.');
  });

  test('returns 400 on an invalid request body', async () => {
    const req = new NextRequest('http://localhost/api/ai/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
