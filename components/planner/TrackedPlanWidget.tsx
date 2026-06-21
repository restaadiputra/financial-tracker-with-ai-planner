'use client';

import type { Budget, Goal, Transaction } from '@/lib/db/schema';
import { findLatestPlanBatch } from '@/lib/ai/planBatch';
import { goalProgress, requiredDailyPace } from '@/lib/finance/calculations';
import { formatMoney } from '@/lib/finance/format';

function daysRemaining(targetDate: number, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((targetDate - now) / 86_400_000));
}

// Reads live from the local DB via the goals/budgets/transactions already
// fetched by the parent page's useLiveQuery hooks — never a snapshot frozen at
// plan-creation time (PRD Section 6.3 / DESIGN.md "Live progress over static
// snapshots").
export function TrackedPlanWidget({
  goals,
  budgets,
  transactions,
  categoryNameById,
}: {
  goals: Goal[];
  budgets: Budget[];
  transactions: Transaction[];
  categoryNameById: Map<string, string>;
}) {
  const batch = findLatestPlanBatch(goals, budgets);
  if (!batch) return null;

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6">
      <h2 className="text-title text-foreground">Tracked plan</h2>

      {batch.goal && (
        <GoalProgress goal={batch.goal} transactions={transactions} />
      )}

      {batch.budgets.length > 0 && (
        <ul className="flex flex-col gap-2">
          {batch.budgets.map((b) => (
            <li key={b.id} className="text-body text-foreground">
              {categoryNameById.get(b.categoryId) ?? b.categoryId}:{' '}
              <span className="tabular-nums">{formatMoney(b.currency, b.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GoalProgress({ goal, transactions }: { goal: Goal; transactions: Transaction[] }) {
  const progress = goalProgress(goal, transactions);
  const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((progress / goal.targetAmount) * 100)) : 0;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-body text-foreground">{goal.name}</p>
      <div className="h-2 w-full rounded-full bg-background">
        <div
          className="h-2 rounded-full bg-accent transition-[width] duration-150 ease-out-quart motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-label text-muted tabular-nums">
        {formatMoney(goal.currency, progress)} of {formatMoney(goal.currency, goal.targetAmount)}
      </p>
      {goal.targetDate && (
        <p className="text-label text-muted">
          {daysRemaining(goal.targetDate)} days left — need{' '}
          <span className="tabular-nums">
            {formatMoney(goal.currency, requiredDailyPace(goal.targetAmount, progress, goal.targetDate))}
          </span>{' '}
          /day to hit it
        </p>
      )}
    </div>
  );
}
