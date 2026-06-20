import type { AssetLiabilitySnapshot, Goal, Transaction } from '@/lib/db/schema';

export interface MonthRange {
  start: number; // inclusive, epoch ms
  end: number; // exclusive, epoch ms (first instant of next month)
}

// The calendar month containing `now`, in local time. Budgets are monthly-only
// (PRD 5.3), so this is the single period boundary the app needs.
export function currentMonthRange(now: number = Date.now()): MonthRange {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  return { start, end };
}

// Total spent (expenses only) in one category and currency within a date range.
// Currency is part of the key because v1 never converts across currencies (PRD 5.7).
export function spentInCategory(
  transactions: Transaction[],
  categoryId: string,
  currency: string,
  range: MonthRange
): number {
  return transactions
    .filter(
      (t) =>
        t.type === 'expense' &&
        t.category === categoryId &&
        t.currency === currency &&
        t.date >= range.start &&
        t.date < range.end
    )
    .reduce((sum, t) => sum + t.amount, 0);
}

// Net worth per currency = income − expense + assets − liabilities (PRD 5.6).
// Returned per-currency, never blended into one number (PRD 5.7).
export function netWorthByCurrency(
  transactions: Transaction[],
  snapshots: AssetLiabilitySnapshot[]
): Map<string, number> {
  const totals = new Map<string, number>();
  const add = (currency: string, value: number) =>
    totals.set(currency, (totals.get(currency) ?? 0) + value);

  for (const t of transactions) add(t.currency, t.type === 'income' ? t.amount : -t.amount);
  for (const s of snapshots) add(s.currency, s.kind === 'asset' ? s.amount : -s.amount);
  return totals;
}

// Current progress toward a goal. Manual `currentAmount` is the default (PRD 5.5);
// only when `linkedCategoryId` is set do we auto-derive from that category's
// transactions in the goal's currency.
// SIMPLICITY NOTE: derived progress sums every transaction tagged to the linked
// category regardless of income/expense direction — a "money that moved through
// this envelope" heuristic. Per-type accounting is deferred (PRD 5.5).
export function goalProgress(goal: Goal, transactions: Transaction[]): number {
  if (!goal.linkedCategoryId) return goal.currentAmount;
  return transactions
    .filter((t) => t.category === goal.linkedCategoryId && t.currency === goal.currency)
    .reduce((sum, t) => sum + t.amount, 0);
}
