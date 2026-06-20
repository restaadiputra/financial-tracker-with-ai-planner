'use client';

import { useState } from 'react';
import type { CategoryRecord, Transaction } from '@/lib/db/schema';

export type TransactionFormValues = Pick<
  Transaction,
  'type' | 'amount' | 'currency' | 'category' | 'note' | 'date'
>;

function toDateInputValue(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

export function TransactionForm({
  categories,
  initialValues,
  onSubmit,
  onCancel,
}: {
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
    <div className="fixed inset-0 z-modal flex items-end justify-center bg-foreground/20 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-t-card border border-border bg-background p-6 shadow-lg sm:rounded-card"
      >
        <h2 className="text-title">{initialValues ? 'Edit transaction' : 'Add transaction'}</h2>

        <div className="flex gap-2">
          {(['expense', 'income'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 rounded-control border px-3 py-1.5 text-label capitalize transition-colors duration-150 ease-out-quart ${
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
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-control border border-border bg-background px-3 py-2 text-body tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </label>
          <label className="flex w-24 flex-col gap-1 text-label">
            Currency
            <input
              required
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              maxLength={3}
              className="rounded-control border border-border bg-background px-3 py-2 text-body uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-label">
          Category
          <select
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-control border border-border bg-background px-3 py-2 text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
            className="rounded-control border border-border bg-background px-3 py-2 text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>

        <label className="flex flex-col gap-1 text-label">
          Note (optional)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="rounded-control border border-border bg-background px-3 py-2 text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>

        {error && <p className="text-label text-danger">{error}</p>}

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-control border border-border px-4 py-2 font-medium text-muted transition-colors duration-150 ease-out-quart hover:border-accent hover:text-foreground active:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-control bg-accent px-4 py-2 font-medium text-accent-foreground transition-colors duration-150 ease-out-quart hover:bg-accent-hover active:bg-accent-active disabled:pointer-events-none disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
