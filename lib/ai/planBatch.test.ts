import { describe, expect, test } from 'vitest';
import type { Budget, Goal } from '@/lib/db/schema';
import { findLatestPlanBatch } from './planBatch';

function goal(partial: Partial<Goal>): Goal {
  return {
    id: crypto.randomUUID(),
    name: 'Goal',
    type: 'savings',
    targetAmount: 1,
    currentAmount: 0,
    currency: 'IDR',
    createdAt: 0,
    ...partial,
  };
}

function budget(partial: Partial<Budget>): Budget {
  return {
    id: crypto.randomUUID(),
    categoryId: 'food',
    amount: 1,
    currency: 'IDR',
    period: 'monthly',
    alertThresholdPct: 80,
    createdAt: 0,
    ...partial,
  };
}

describe('findLatestPlanBatch', () => {
  test('returns null when nothing has an aiPlanBatchId', () => {
    expect(findLatestPlanBatch([goal({})], [budget({})])).toBeNull();
  });

  test('picks the batch with the newest createdAt across its goal and budgets', () => {
    const olderGoal = goal({ aiPlanBatchId: 'batch-old', createdAt: 100, name: 'Old goal' });
    const newerGoal = goal({ aiPlanBatchId: 'batch-new', createdAt: 300, name: 'New goal' });
    const newerBudget = budget({ aiPlanBatchId: 'batch-new', createdAt: 200, categoryId: 'food' });
    const olderBudget = budget({ aiPlanBatchId: 'batch-old', createdAt: 50, categoryId: 'transport' });

    const result = findLatestPlanBatch([olderGoal, newerGoal], [newerBudget, olderBudget]);

    expect(result?.id).toBe('batch-new');
    expect(result?.goal?.name).toBe('New goal');
    expect(result?.budgets).toEqual([newerBudget]);
  });

  test('handles a batch with budgets but no goal', () => {
    const b = budget({ aiPlanBatchId: 'batch-1', createdAt: 10 });
    const result = findLatestPlanBatch([], [b]);
    expect(result).toEqual({ id: 'batch-1', goal: undefined, budgets: [b] });
  });
});
