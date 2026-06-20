'use client';

import { useId, useState } from 'react';
import type { CategoryRecord, Goal } from '@/lib/db/schema';
import { Sheet } from '@/components/ui/Sheet';
import { fieldClass, primaryButton, secondaryButton } from '@/components/ui/controls';

export type GoalFormValues = Omit<Goal, 'id' | 'createdAt'>;

function toDateInputValue(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function GoalForm({
  categories,
  initialValues,
  onSubmit,
  onCancel,
}: {
  categories: CategoryRecord[];
  initialValues?: Goal;
  onSubmit: (values: GoalFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [type, setType] = useState<'savings' | 'debt_payoff'>(initialValues?.type ?? 'savings');
  const [targetAmount, setTargetAmount] = useState(initialValues ? String(initialValues.targetAmount) : '');
  const [currentAmount, setCurrentAmount] = useState(
    initialValues ? String(initialValues.currentAmount) : '0'
  );
  const [currency, setCurrency] = useState(initialValues?.currency ?? 'IDR');
  const [targetDate, setTargetDate] = useState(
    initialValues?.targetDate ? toDateInputValue(initialValues.targetDate) : ''
  );
  const [linkedCategoryId, setLinkedCategoryId] = useState(initialValues?.linkedCategoryId ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();

  const linked = linkedCategoryId !== '';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsedTarget = Number(targetAmount);
    const parsedCurrent = Number(currentAmount);
    if (!name.trim()) {
      setError('Give your goal a name.');
      return;
    }
    if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
      setError('Enter a target greater than zero.');
      return;
    }
    if (!linked && (!Number.isFinite(parsedCurrent) || parsedCurrent < 0)) {
      setError('Enter a current amount of zero or more.');
      return;
    }

    setSubmitting(true);
    await onSubmit({
      name: name.trim(),
      type,
      targetAmount: parsedTarget,
      // When linked, progress is derived from transactions, so manual amount is moot.
      currentAmount: linked ? 0 : parsedCurrent,
      currency,
      targetDate: targetDate ? new Date(targetDate).getTime() : undefined,
      linkedCategoryId: linked ? linkedCategoryId : undefined,
    });
    setSubmitting(false);
  }

  return (
    <Sheet open onClose={onCancel} variant="modal" labelledBy={titleId}>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
          <h2 id={titleId} className="text-title">
            {initialValues ? 'Edit goal' : 'New goal'}
          </h2>

          <div className="flex gap-2">
            {(
              [
                ['savings', 'Savings'],
                ['debt_payoff', 'Debt payoff'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                aria-pressed={type === value}
                className={`flex-1 rounded-control border px-3 py-2.5 text-label transition-colors duration-150 ease-out-quart ${
                  type === value
                    ? 'border-accent bg-accent text-accent-foreground hover:bg-accent-hover active:bg-accent-active'
                    : 'border-border text-muted hover:border-accent hover:text-foreground active:bg-surface-hover'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-1 text-label">
            Name
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. New laptop, Pay off credit card"
              className={fieldClass}
            />
          </label>

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-label">
              Target amount
              <input
                required
                inputMode="decimal"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className={`${fieldClass} tabular-nums`}
              />
            </label>
            <label className="flex w-24 flex-col gap-1 text-label">
              Currency
              <input
                required
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                className={`${fieldClass} uppercase`}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-label">
            Target date (optional)
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className={fieldClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-label">
            Track progress from a category (optional)
            <select
              value={linkedCategoryId}
              onChange={(e) => setLinkedCategoryId(e.target.value)}
              className={fieldClass}
            >
              <option value="">Update progress manually</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {!linked && (
            <label className="flex flex-col gap-1 text-label">
              Current amount saved
              <input
                inputMode="decimal"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                className={`${fieldClass} tabular-nums`}
              />
            </label>
          )}

          {error && <p className="text-label text-danger">{error}</p>}
        </div>

        <div className="sticky bottom-0 flex gap-2 border-t border-border bg-background px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onCancel} className={`flex-1 ${secondaryButton}`}>
            Cancel
          </button>
          <button type="submit" disabled={submitting} className={`flex-1 ${primaryButton}`}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
