'use client';

import { useId, useState } from 'react';
import type { CategoryRecord, Transaction } from '@/lib/db/schema';
import { Sheet } from '@/components/ui/Sheet';

export type TransactionFormValues = Pick<
  Transaction,
  'type' | 'amount' | 'currency' | 'category' | 'note' | 'date'
>;

function toDateInputValue(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

const fieldClass =
  'rounded-control border border-border bg-background px-3 py-2.5 text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function TransactionForm({
  open = true,
  categories,
  initialValues,
  onSubmit,
  onCancel,
}: {
  open?: boolean;
  categories: CategoryRecord[];
  initialValues?: Transaction;
  onSubmit: (values: TransactionFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [type, setType] = useState<'income' | 'expense'>(initialValues?.type ?? 'expense');
  const [amount, setAmount] = useState(initialValues ? String(initialValues.amount) : '');
  const [currency, setCurrency] = useState(initialValues?.currency ?? 'IDR');
  const [category, setCategory] = useState(initialValues?.category ?? categories[0]?.id ?? '');
  const [note, setNote] = useState(initialValues?.note ?? '');
  const [date, setDate] = useState(() => toDateInputValue(initialValues?.date ?? Date.now()));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();

  const relevantCategories = categories.filter((c) => c.type === type || c.type === 'both');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!category) {
      setError('Pick a category.');
      return;
    }

    setSubmitting(true);
    await onSubmit({
      type,
      amount: parsedAmount,
      currency,
      category,
      note: note || undefined,
      date: new Date(date).getTime(),
    });
    setSubmitting(false);
  }

  return (
    <Sheet open={open} onClose={onCancel} variant="modal" labelledBy={titleId}>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
          <h2 id={titleId} className="text-title">
            {initialValues ? 'Edit transaction' : 'Add transaction'}
          </h2>

          <div className="flex gap-2">
            {(['expense', 'income'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={type === t}
                className={`flex-1 rounded-control border px-3 py-2.5 text-label capitalize transition-colors duration-150 ease-out-quart ${
                  type === t
                    ? 'border-accent bg-accent text-accent-foreground hover:bg-accent-hover active:bg-accent-active'
                    : 'border-border text-muted hover:border-accent hover:text-foreground active:bg-surface-hover'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-label">
              Amount
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
            Category
            <select
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={fieldClass}
            >
              {relevantCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-label">
            Date
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={fieldClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-label">
            Note (optional)
            <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldClass} />
          </label>

          {error && <p className="text-label text-danger">{error}</p>}
        </div>

        {/* Sticky footer keeps the primary action thumb-reachable on tall sheets. */}
        <div className="sticky bottom-0 flex gap-2 border-t border-border bg-background px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-control border border-border px-4 py-2.5 font-medium text-muted transition-colors duration-150 ease-out-quart hover:border-accent hover:text-foreground active:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-control bg-accent px-4 py-2.5 font-medium text-accent-foreground transition-colors duration-150 ease-out-quart hover:bg-accent-hover active:bg-accent-active disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
