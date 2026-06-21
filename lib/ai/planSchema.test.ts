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
});
