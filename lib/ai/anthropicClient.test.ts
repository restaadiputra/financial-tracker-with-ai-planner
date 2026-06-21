import { afterEach, describe, expect, test, vi } from 'vitest';
import { AnthropicConfigError, callPlannerModel } from './anthropicClient';

const ORIGINAL_ENV = process.env.ANTHROPIC_API_KEY;

afterEach(() => {
  process.env.ANTHROPIC_API_KEY = ORIGINAL_ENV;
  vi.unstubAllGlobals();
});

describe('callPlannerModel', () => {
  test('throws AnthropicConfigError when ANTHROPIC_API_KEY is not set', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(callPlannerModel('system', [])).rejects.toBeInstanceOf(AnthropicConfigError);
  });

  test('sends the system prompt and history, and returns the response text', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: '{"message":"hi"}' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await callPlannerModel('system prompt', [{ role: 'user', content: 'hello' }]);

    expect(result).toBe('{"message":"hi"}');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('test-key');
    const body = JSON.parse(init.body);
    expect(body.system).toBe('system prompt');
    expect(body.messages).toEqual([{ role: 'user', content: 'hello' }]);
  });

  test('throws when the Anthropic API responds with a non-ok status', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(callPlannerModel('system', [])).rejects.toThrow('Anthropic API error: 500');
  });

  test('throws when the response has no text content', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ content: [] }) }));
    await expect(callPlannerModel('system', [])).rejects.toThrow('no text content');
  });
});
