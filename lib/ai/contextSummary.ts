import type { Budget, Goal, Transaction } from '@/lib/db/schema';

export interface CategorySummary {
  categoryId: string;
  currency: string;
  income: number;
  expense: number;
}

export interface BudgetSummary {
  categoryId: string;
  amount: number;
  currency: string;
  alertThresholdPct: number;
}

export interface GoalSummary {
  name: string;
  type: Goal['type'];
  targetAmount: number;
  currentAmount: number;
  currency: string;
  targetDate?: number;
}

export interface PlanContext {
  periodStart: number;
  periodEnd: number;
  categorySummaries: CategorySummary[];
  budgets: BudgetSummary[];
  goals: GoalSummary[];
}

const CONTEXT_WINDOW_MS = 90 * 86_400_000;

// SIMPLICITY NOTE: sends the AI per-category/per-currency aggregates instead of
// raw transactions (PRD Section 6.1, CLAUDE.md principle 3 — minimum data needed).
// Smaller payload, cheaper, and never exposes individual notes/merchants to the
// API call. The AI only ever reasons about category-level totals, which is
// sufficient for budgeting/savings advice.
export function buildPlanContext(
  transactions: Transaction[],
  budgets: Budget[],
  goals: Goal[],
  now: number = Date.now()
): PlanContext {
  const periodStart = now - CONTEXT_WINDOW_MS;
  const periodEnd = now;

  const byKey = new Map<string, CategorySummary>();
  for (const t of transactions) {
    if (t.date < periodStart || t.date > periodEnd) continue;
    const key = `${t.category}::${t.currency}`;
    const existing = byKey.get(key) ?? {
      categoryId: t.category,
      currency: t.currency,
      income: 0,
      expense: 0,
    };
    if (t.type === 'income') existing.income += t.amount;
    else existing.expense += t.amount;
    byKey.set(key, existing);
  }

  return {
    periodStart,
    periodEnd,
    categorySummaries: Array.from(byKey.values()),
    budgets: budgets.map((b) => ({
      categoryId: b.categoryId,
      amount: b.amount,
      currency: b.currency,
      alertThresholdPct: b.alertThresholdPct,
    })),
    goals: goals.map((g) => ({
      name: g.name,
      type: g.type,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      currency: g.currency,
      targetDate: g.targetDate,
    })),
  };
}
