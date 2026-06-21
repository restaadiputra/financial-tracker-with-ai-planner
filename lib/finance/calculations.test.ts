import { describe, expect, test } from 'vitest';
import type { AssetLiabilitySnapshot, Goal, Transaction } from '@/lib/db/schema';
import { currentMonthRange, goalProgress, netSavingsSince, netWorthByCurrency, requiredDailyPace, spentInCategory } from './calculations';

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

describe('currentMonthRange', () => {
  test('spans the calendar month containing now, end-exclusive', () => {
    const { start, end } = currentMonthRange(new Date('2026-06-20T10:00:00').getTime());
    expect(new Date(start).getDate()).toBe(1);
    expect(new Date(start).getMonth()).toBe(5); // June
    expect(new Date(end).getMonth()).toBe(6); // July 1
    expect(new Date(end).getDate()).toBe(1);
  });
});

describe('spentInCategory', () => {
  const range = currentMonthRange(new Date('2026-06-15').getTime());

  test('sums only matching expense/category/currency within the range', () => {
    const transactions = [
      tx({ amount: 50000, date: new Date('2026-06-02').getTime() }),
      tx({ amount: 20000, date: new Date('2026-06-10').getTime() }),
      tx({ amount: 99999, type: 'income', date: new Date('2026-06-05').getTime() }), // income ignored
      tx({ amount: 7000, category: 'transport', date: new Date('2026-06-05').getTime() }), // other category
      tx({ amount: 5, currency: 'USD', date: new Date('2026-06-05').getTime() }), // other currency
      tx({ amount: 88000, date: new Date('2026-05-30').getTime() }), // previous month
    ];
    expect(spentInCategory(transactions, 'food', 'IDR', range)).toBe(70000);
  });
});

describe('netWorthByCurrency', () => {
  test('income − expense + assets − liabilities, kept per currency', () => {
    const transactions = [
      tx({ type: 'income', amount: 5_000_000, currency: 'IDR' }),
      tx({ type: 'expense', amount: 1_000_000, currency: 'IDR' }),
      tx({ type: 'income', amount: 200, currency: 'USD' }),
    ];
    const snapshots: AssetLiabilitySnapshot[] = [
      { id: '1', name: 'BCA', kind: 'asset', amount: 3_000_000, currency: 'IDR', updatedAt: 0 },
      { id: '2', name: 'Loan', kind: 'liability', amount: 2_000_000, currency: 'IDR', updatedAt: 0 },
    ];
    const result = netWorthByCurrency(transactions, snapshots);
    expect(result.get('IDR')).toBe(5_000_000); // 5m - 1m + 3m - 2m
    expect(result.get('USD')).toBe(200);
  });
});

describe('goalProgress', () => {
  const base: Goal = {
    id: 'g1',
    name: 'Laptop',
    type: 'savings',
    targetAmount: 10_000_000,
    currentAmount: 4_000_000,
    currency: 'IDR',
    createdAt: 0,
  };

  test('returns the manual amount when no category is linked', () => {
    expect(goalProgress(base, [])).toBe(4_000_000);
  });

  test('derives from linked category transactions when linked', () => {
    const linked: Goal = { ...base, linkedCategoryId: 'savings-cat' };
    const transactions = [
      tx({ type: 'income', amount: 1_000_000, category: 'savings-cat' }),
      tx({ type: 'income', amount: 500_000, category: 'savings-cat' }),
      tx({ type: 'income', amount: 9_999, category: 'other' }), // ignored
      tx({ type: 'income', amount: 50, currency: 'USD', category: 'savings-cat' }), // wrong currency
    ];
    expect(goalProgress(linked, transactions)).toBe(1_500_000);
  });
});

describe('requiredDailyPace', () => {
  test('divides the remaining amount by whole days remaining', () => {
    const now = new Date('2026-06-20').getTime();
    const targetDate = new Date('2026-06-30').getTime(); // 10 days out
    expect(requiredDailyPace(10_000_000, 4_000_000, targetDate, now)).toBe(600_000);
  });

  test('floors days remaining at 1 so an overdue/today target does not divide by zero or go negative', () => {
    const now = new Date('2026-06-20T12:00:00').getTime();
    const targetDate = new Date('2026-06-20T08:00:00').getTime(); // already past
    expect(requiredDailyPace(1_000_000, 0, targetDate, now)).toBe(1_000_000);
  });
});

describe('netSavingsSince', () => {
  test('sums income minus expense, in one currency, from a start time onward', () => {
    const since = new Date('2026-06-01').getTime();
    const transactions = [
      tx({ type: 'income', amount: 5_000_000, currency: 'IDR', date: new Date('2026-06-05').getTime() }),
      tx({ type: 'expense', amount: 1_000_000, currency: 'IDR', date: new Date('2026-06-10').getTime() }),
      tx({ type: 'income', amount: 999_999, currency: 'IDR', date: new Date('2026-05-30').getTime() }), // before `since`
      tx({ type: 'income', amount: 50, currency: 'USD', date: new Date('2026-06-06').getTime() }), // other currency
    ];
    expect(netSavingsSince(transactions, 'IDR', since)).toBe(4_000_000);
  });

  test('can go negative when expenses exceed income in range', () => {
    const since = new Date('2026-06-01').getTime();
    const transactions = [tx({ type: 'expense', amount: 200_000, currency: 'IDR', date: new Date('2026-06-05').getTime() })];
    expect(netSavingsSince(transactions, 'IDR', since)).toBe(-200_000);
  });
});
