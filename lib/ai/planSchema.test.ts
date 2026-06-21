import { describe, expect, test } from 'vitest';
import { parsePlannerResponse } from './planSchema';

describe('parsePlannerResponse', () => {
  test('parses a plain JSON message with no proposed plan', () => {
    const raw = JSON.stringify({ message: 'You are on track.' });
    expect(parsePlannerResponse(raw)).toEqual({ message: 'You are on track.', proposedPlan: undefined });
  });

  test('parses a JSON message wrapped in a markdown code fence', () => {
    const raw = '```json\n' + JSON.stringify({ message: 'Hi' }) + '\n```';
    expect(parsePlannerResponse(raw)).toEqual({ message: 'Hi', proposedPlan: undefined });
  });

  test('parses a valid proposedPlan with budget adjustments', () => {
    const payload = {
      message: "Here's a plan.",
      proposedPlan: {
        type: 'savings_goal',
        goalName: 'Emergency fund',
        targetAmount: 10_000_000,
        currency: 'IDR',
        budgetAdjustments: [{ categoryId: 'food', suggestedAmount: 800_000 }],
      },
    };
    expect(parsePlannerResponse(JSON.stringify(payload))).toEqual(payload);
  });

  test('fails open to a plain message when JSON is malformed', () => {
    const raw = 'not json at all';
    expect(parsePlannerResponse(raw)).toEqual({ message: 'not json at all', proposedPlan: undefined });
  });

  test('fails open and drops proposedPlan when its shape is invalid', () => {
    const raw = JSON.stringify({ message: 'Hi', proposedPlan: { type: 'not_a_real_type' } });
    expect(parsePlannerResponse(raw)).toEqual({ message: 'Hi', proposedPlan: undefined });
  });

  test('fails open and drops proposedPlan when a budget adjustment is malformed', () => {
    const raw = JSON.stringify({
      message: 'Hi',
      proposedPlan: { type: 'budget_adjustment', budgetAdjustments: [{ categoryId: 'food' }] },
    });
    expect(parsePlannerResponse(raw)).toEqual({ message: 'Hi', proposedPlan: undefined });
  });

  test('recovers the message when the response is truncated mid-JSON with no closing fence', () => {
    // A real failure mode: the model gets cut off (token limit) before closing
    // its code fence or the JSON object. The raw text looks like:
    // ```json { "message": "That's an exciting goal! ...90 days.
    // — no closing quote, no closing brace, no closing fence.
    const raw = '```json\n{ "message": "That\'s an exciting goal! Spending is at 200,000 IDR over the last 90 days.';
    const result = parsePlannerResponse(raw);
    expect(result.message).toBe("That's an exciting goal! Spending is at 200,000 IDR over the last 90 days.");
    expect(result.proposedPlan).toBeUndefined();
  });

  test('recovers the message when truncated mid-escape-sequence inside the string', () => {
    const raw = '```json\n{ "message": "Line one\\';
    const result = parsePlannerResponse(raw);
    // Best-effort: the dangling trailing backslash isn't a complete escape
    // sequence, so it's dropped rather than included or causing a throw.
    expect(result.message).toBe('Line one');
    expect(result.proposedPlan).toBeUndefined();
  });

  test('still falls back to the full raw text when there is no recognizable "message" field at all', () => {
    const raw = 'the model said something completely unstructured';
    expect(parsePlannerResponse(raw)).toEqual({ message: raw, proposedPlan: undefined });
  });
});
