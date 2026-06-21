// SIMPLICITY NOTE: calls the Anthropic Messages API directly via fetch instead
// of adding the @anthropic-ai/sdk dependency — same zero-extra-dependency
// posture this repo already uses for crypto (native Web Crypto over an
// external lib). One JSON request, one JSON response; no streaming.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 2048;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export class AnthropicConfigError extends Error {}

export async function callPlannerModel(systemPrompt: string, history: ChatTurn[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AnthropicConfigError('ANTHROPIC_API_KEY is not set');
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: history,
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text;
  if (typeof text !== 'string') {
    throw new Error('Anthropic API response had no text content');
  }
  return text;
}
