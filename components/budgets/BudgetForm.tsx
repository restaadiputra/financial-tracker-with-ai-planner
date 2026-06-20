'use client';

import { useId, useState } from 'react';
import type { Budget, CategoryRecord } from '@/lib/db/schema';
import { Sheet } from '@/components/ui/Sheet';
import { fieldClass, primaryButton, secondaryButton } from '@/components/ui/controls';

export type BudgetFormValues = Pick<
  Budget,
  'categoryId' | 'amount' | 'currency' | 'alertThresholdPct' | 'period'
>;

export function BudgetForm({
  categories,
  initialValues,
  onSubmit,
  onCancel,
}: {
  categories: CategoryRecord[];
  initialValues?: Budget;
  onSubmit: (values: BudgetFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [categoryId, setCategoryId] = useState(initialValues?.categoryId ?? categories[0]?.id ?? '');
  const [amount, setAmount] = useState(initialValues ? String(initialValues.amount) : '');
  const [currency, setCurrency] = useState(initialValues?.currency ?? 'IDR');
  const [threshold, setThreshold] = useState(String(initialValues?.alertThresholdPct ?? 80));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    const parsedThreshold = Number(threshold);
    if (!categoryId) {
      setError('Pick a category.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a budget greater than zero.');
      return;
    }
    if (!Number.isFinite(parsedThreshold) || parsedThreshold < 1 || parsedThreshold > 100) {
      setError('Alert threshold must be between 1 and 100.');
      return;
    }
    setSubmitting(true);
    await onSubmit({
      categoryId,
      amount: parsedAmount,
      currency,
      alertThresholdPct: parsedThreshold,
      period: 'monthly',
    });
    setSubmitting(false);
  }

  return (
    <Sheet open onClose={onCancel} variant="modal" labelledBy={titleId}>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
          <h2 id={titleId} className="text-title">
            {initialValues ? 'Edit budget' : 'New monthly budget'}
          </h2>

          <label className="flex flex-col gap-1 text-label">
            Category
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={fieldClass}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-label">
              Monthly amount
              <input
                required
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
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
            Warn me at (% spent)
            <input
              required
              inputMode="numeric"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className={`${fieldClass} tabular-nums`}
            />
          </label>

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
