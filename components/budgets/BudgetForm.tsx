'use client';

import { useId, useState } from 'react';
import type { Budget, CategoryRecord } from '@/lib/db/schema';
import { Sheet } from '@/components/ui/Sheet';
import { AmountInput } from '@/components/ui/AmountInput';
import { FormError, RequiredMark } from '@/components/ui/form';
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
  const [amount, setAmount] = useState<number | null>(initialValues?.amount ?? null);
  const [currency, setCurrency] = useState(initialValues?.currency ?? 'IDR');
  const [threshold, setThreshold] = useState(String(initialValues?.alertThresholdPct ?? 80));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const errorId = useId();

  // Percentages are whole numbers 1–100: strip non-digits on input, clamp on change.
  function handleThresholdChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 3);
    if (digits === '') return setThreshold('');
    setThreshold(String(Math.min(Number(digits), 100)));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsedThreshold = Number(threshold);
    if (!categoryId) {
      setError('Pick a category.');
      return;
    }
    if (amount === null || amount <= 0) {
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
      amount,
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
            <span>
              Category
              <RequiredMark />
            </span>
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
              <span>
                Monthly amount
                <RequiredMark />
              </span>
              <AmountInput
                required
                autoFocus
                initialValue={initialValues?.amount}
                onValueChange={setAmount}
                aria-invalid={error != null && (amount === null || amount <= 0)}
                aria-describedby={error ? errorId : undefined}
                className={`${fieldClass} tabular-nums`}
              />
            </label>
            <label className="flex w-24 flex-col gap-1 text-label">
              <span>
                Currency
                <RequiredMark />
              </span>
              <input
                required
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                aria-label="Currency code, 3 letters"
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
              onChange={(e) => handleThresholdChange(e.target.value)}
              aria-describedby={`${errorId}-threshold-help`}
              className={`${fieldClass} tabular-nums`}
            />
            <span id={`${errorId}-threshold-help`} className="text-micro-label text-muted">
              A whole number from 1 to 100.
            </span>
          </label>

          {error && <FormError id={errorId}>{error}</FormError>}
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
