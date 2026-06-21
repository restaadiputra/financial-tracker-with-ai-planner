'use client';

import { useState } from 'react';
import type { ProposedPlan } from '@/lib/ai/planSchema';
import { formatMoney } from '@/lib/finance/format';
import { primaryButton, secondaryButton } from '@/components/ui/controls';

export interface ConfirmedSelection {
  goal: boolean;
  budgetAdjustmentIndexes: number[];
}

// Never auto-write an AI-proposed plan (CLAUDE.md / DESIGN.md "Confirm before
// the AI touches real data"): every goal and every budget-adjustment line has
// its own checkbox, default-checked, so the user can deselect individual lines
// before anything is written to the local DB.
export function PlanConfirmCard({
  plan,
  categoryNameById,
  onConfirm,
  onDismiss,
}: {
  plan: ProposedPlan;
  categoryNameById: Map<string, string>;
  onConfirm: (selection: ConfirmedSelection) => void;
  onDismiss: () => void;
}) {
  const hasGoal = plan.type === 'savings_goal' && Boolean(plan.goalName) && plan.targetAmount !== undefined;
  const adjustments = plan.budgetAdjustments ?? [];

  const [goalChecked, setGoalChecked] = useState(hasGoal);
  const [adjustmentChecked, setAdjustmentChecked] = useState<boolean[]>(adjustments.map(() => true));

  function toggleAdjustment(index: number) {
    setAdjustmentChecked((prev) => prev.map((v, i) => (i === index ? !v : v)));
  }

  function handleConfirm() {
    onConfirm({
      goal: hasGoal && goalChecked,
      budgetAdjustmentIndexes: adjustmentChecked.flatMap((checked, i) => (checked ? [i] : [])),
    });
  }

  const nothingSelected = !(hasGoal && goalChecked) && !adjustmentChecked.some(Boolean);

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6">
      <h2 className="text-title text-foreground">Proposed plan</h2>

      {hasGoal && (
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={goalChecked}
            onChange={(e) => setGoalChecked(e.target.checked)}
            className="mt-1"
          />
          <span className="text-body text-foreground">
            New goal: <strong>{plan.goalName}</strong> —{' '}
            {formatMoney(plan.currency ?? '', plan.targetAmount ?? 0)}
            {plan.targetDate ? ` by ${new Date(plan.targetDate).toLocaleDateString()}` : ''}
          </span>
        </label>
      )}

      {adjustments.map((adj, i) => (
        <label key={`${adj.categoryId}-${i}`} className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={adjustmentChecked[i]}
            onChange={() => toggleAdjustment(i)}
            className="mt-1"
          />
          <span className="text-body text-foreground">
            Set {categoryNameById.get(adj.categoryId) ?? adj.categoryId} budget to{' '}
            <strong>{adj.suggestedAmount.toLocaleString()}</strong>
          </span>
        </label>
      ))}

      <div className="flex gap-2">
        <button type="button" className={primaryButton} onClick={handleConfirm} disabled={nothingSelected}>
          Confirm
        </button>
        <button type="button" className={secondaryButton} onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
