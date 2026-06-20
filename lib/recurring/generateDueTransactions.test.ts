import { describe, expect, test } from 'vitest';
import { FinanceTrackerDB } from '@/lib/db/db';
import { deriveKeyFromPassword, generateSalt } from '@/lib/crypto/deriveKey';
import { recurringRules } from '@/lib/db/recurringRules';
import { listTransactions } from '@/lib/db/transactions';
import type { RecurringRule } from '@/lib/db/schema';
import { dueOccurrences, generateDueTransactions } from './generateDueTransactions';

function freshDb() {
  return new FinanceTrackerDB(`test-db-${crypto.randomUUID()}`);
}

async function testKey() {
  return deriveKeyFromPassword('correct-horse', generateSalt());
}

// Occurrences are computed at LOCAL midnight, so format in local time too —
// toISOString would render in UTC and shift the day under a non-UTC offset.
function ymd(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function rule(partial: Partial<RecurringRule>): RecurringRule {
  return {
    id: 'r1',
    type: 'expense',
    amount: 100000,
    currency: 'IDR',
    category: 'bills',
    frequency: 'monthly',
    startDate: new Date('2026-01-15').getTime(),
    isActive: true,
    ...partial,
  };
}

describe('dueOccurrences', () => {
  test('monthly rule generates each month up to and including today', () => {
    const r = rule({ frequency: 'monthly', dayOfMonth: 15, startDate: new Date('2026-01-15').getTime() });
    const occ = dueOccurrences(r, new Date('2026-03-20').getTime());
    expect(occ.map(ymd)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
  });

  test('only generates occurrences after lastGeneratedDate', () => {
    const r = rule({
      frequency: 'monthly',
      dayOfMonth: 15,
      startDate: new Date('2026-01-15').getTime(),
      lastGeneratedDate: new Date('2026-02-15').getTime(),
    });
    const occ = dueOccurrences(r, new Date('2026-04-01').getTime());
    expect(occ.map(ymd)).toEqual(['2026-03-15']);
  });

  test('inactive rules generate nothing', () => {
    expect(dueOccurrences(rule({ isActive: false }), new Date('2027-01-01').getTime())).toEqual([]);
  });

  test('respects endDate', () => {
    const r = rule({
      frequency: 'monthly',
      dayOfMonth: 15,
      startDate: new Date('2026-01-15').getTime(),
      endDate: new Date('2026-02-15').getTime(),
    });
    const occ = dueOccurrences(r, new Date('2026-06-01').getTime());
    expect(occ).toHaveLength(2);
  });

  test('clamps day-of-month to short months', () => {
    const r = rule({ frequency: 'monthly', dayOfMonth: 31, startDate: new Date('2026-01-31').getTime() });
    const occ = dueOccurrences(r, new Date('2026-02-28').getTime());
    expect(occ.map(ymd)).toEqual(['2026-01-31', '2026-02-28']);
  });

  test('weekly rule steps by 7 days from the first matching weekday', () => {
    // 2026-01-15 is a Thursday (day 4). Ask for Mondays (day 1).
    const r = rule({ frequency: 'weekly', dayOfWeek: 1, startDate: new Date('2026-01-15').getTime() });
    const occ = dueOccurrences(r, new Date('2026-02-05').getTime());
    expect(occ.map((o) => new Date(o).getDay())).toEqual([1, 1, 1]);
    expect(ymd(occ[0])).toBe('2026-01-19');
  });
});

describe('generateDueTransactions', () => {
  test('materialises transactions, tags them to the rule, and advances lastGeneratedDate', async () => {
    const db = freshDb();
    const key = await testKey();
    const created = await recurringRules.add(db, key, 'profile-1', {
      type: 'expense',
      amount: 100000,
      currency: 'IDR',
      category: 'bills',
      frequency: 'monthly',
      dayOfMonth: 15,
      startDate: new Date('2026-01-15').getTime(),
      isActive: true,
    });

    const count = await generateDueTransactions(db, key, 'profile-1', new Date('2026-03-20').getTime());
    expect(count).toBe(3);

    const transactions = await listTransactions(db, key, 'profile-1');
    expect(transactions).toHaveLength(3);
    expect(transactions.every((t) => t.recurringRuleId === created.id)).toBe(true);

    // Re-running the same day is idempotent.
    const again = await generateDueTransactions(db, key, 'profile-1', new Date('2026-03-20').getTime());
    expect(again).toBe(0);
    expect(await listTransactions(db, key, 'profile-1')).toHaveLength(3);
  });
});
