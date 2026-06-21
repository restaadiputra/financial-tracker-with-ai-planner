import { describe, expect, test } from 'vitest';
import type { Budget, CategoryRecord, Goal, Transaction } from '@/lib/db/schema';
import { buildPlanContext } from './contextSummary';

const DAY_MS = 86_400_000;

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    type: 'expense',
    amount: 0,
    currency: 'IDR',
    category: 'food',
    date: Date.now(),
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

describe('buildPlanContext', () => {
  test('aggregates income/expense per category and currency within the last 90 days', () => {
    const now = new Date('2026-06-21').getTime();
    const transactions = [
      tx({ amount: 50_000, category: 'food', currency: 'IDR', date: now - 1 * DAY_MS }),
      tx({ amount: 20_000, category: 'food', currency: 'IDR', date: now - 2 * DAY_MS }),
      tx({ amount: 5_000_000, type: 'income', category: 'salary', currency: 'IDR', date: now - 3 * DAY_MS }),
      tx({ amount: 10, category: 'food', currency: 'USD', date: now - 4 * DAY_MS }), // separate currency bucket
      tx({ amount: 99_999, category: 'food', currency: 'IDR', date: now - 91 * DAY_MS }), // outside window
    ];

    const categories: CategoryRecord[] = [
      { id: 'food', profileId: 'p1', name: 'Food', icon: 'utensils', color: '#000', type: 'expense', isDefault: true },
      { id: 'salary', profileId: 'p1', name: 'Salary', icon: 'banknote', color: '#000', type: 'income', isDefault: true },
    ];
    const context = buildPlanContext(transactions, [], [], categories, now);

    const food = context.categorySummaries.find((c) => c.categoryId === 'food' && c.currency === 'IDR');
    expect(food).toEqual({ categoryId: 'food', categoryName: 'Food', currency: 'IDR', income: 0, expense: 70_000 });

    const salary = context.categorySummaries.find((c) => c.categoryId === 'salary');
    expect(salary).toEqual({ categoryId: 'salary', categoryName: 'Salary', currency: 'IDR', income: 5_000_000, expense: 0 });

    const foodUsd = context.categorySummaries.find((c) => c.categoryId === 'food' && c.currency === 'USD');
    expect(foodUsd).toEqual({ categoryId: 'food', categoryName: 'Food', currency: 'USD', income: 0, expense: 10 });

    // the 91-day-old transaction must not appear in any bucket's totals
    expect(context.categorySummaries.reduce((sum, c) => sum + c.expense, 0)).toBe(70_010);
  });

  test('passes through budgets and goals as compact summaries', () => {
    const budgets: Budget[] = [
      { id: 'b1', categoryId: 'food', amount: 1_000_000, currency: 'IDR', period: 'monthly', alertThresholdPct: 80, createdAt: 0 },
    ];
    const goals: Goal[] = [
      { id: 'g1', name: 'Laptop', type: 'savings', targetAmount: 10_000_000, currentAmount: 2_000_000, currency: 'IDR', createdAt: 0 },
    ];

    const context = buildPlanContext([], budgets, goals, [], Date.now());

    expect(context.budgets).toEqual([
      { categoryId: 'food', amount: 1_000_000, currency: 'IDR', alertThresholdPct: 80 },
    ]);
    expect(context.goals).toEqual([
      { name: 'Laptop', type: 'savings', targetAmount: 10_000_000, currentAmount: 2_000_000, currency: 'IDR', targetDate: undefined },
    ]);
  });

  test('falls back to the raw categoryId when no matching category record exists', () => {
    const context = buildPlanContext(
      [tx({ category: 'ghost-category', currency: 'IDR' })],
      [],
      [],
      [] // no category records at all
    );
    expect(context.categorySummaries[0].categoryName).toBe('ghost-category');
  });
});
