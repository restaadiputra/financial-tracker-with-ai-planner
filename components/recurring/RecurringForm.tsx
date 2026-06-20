'use client';

import { useId, useState } from 'react';
import type { CategoryRecord, RecurringRule } from '@/lib/db/schema';
import { Sheet } from '@/components/ui/Sheet';
import { fieldClass, primaryButton, secondaryButton } from '@/components/ui/controls';

export type RecurringFormValues = Omit<RecurringRule, 'id' | 'lastGeneratedDate'>;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toDateInputValue(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function RecurringForm({
  categories,
  initialValues,
  onSubmit,
  onCancel,
}: {
  categories: CategoryRecord[];
  initialValues?: RecurringRule;
  onSubmit: (values: RecurringFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [type, setType] = useState<'income' | 'expense'>(initialValues?.type ?? 'expense');
  const [amount, setAmount] = useState(initialValues ? String(initialValues.amount) : '');
  const [currency, setCurrency] = useState(initialValues?.currency ?? 'IDR');
  const [category, setCategory] = useState(initialValues?.category ?? '');
  const [note, setNote] = useState(initialValues?.note ?? '');
  const [frequency, setFrequency] = useState<RecurringRule['frequency']>(
    initialValues?.frequency ?? 'monthly'
  );
  const [dayOfMonth, setDayOfMonth] = useState(() =>
    String(initialValues?.dayOfMonth ?? new Date(initialValues?.startDate ?? Date.now()).getDate())
  );
  const [dayOfWeek, setDayOfWeek] = useState(String(initialValues?.dayOfWeek ?? 1));
  const [startDate, setStartDate] = useState(() =>
    toDateInputValue(initialValues?.startDate ?? Date.now())
  );
  const [endDate, setEndDate] = useState(initialValues?.endDate ? toDateInputValue(initialValues.endDate) : '');
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();

  const relevantCategories = categories.filter((c) => c.type === type || c.type === 'both');
  const initialCategory = relevantCategories.some((c) => c.id === category)
    ? category
    : relevantCategories[0]?.id ?? '';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!initialCategory) {
      setError('Pick a category.');
      return;
    }
    const start = new Date(startDate).getTime();
    const end = endDate ? new Date(endDate).getTime() : undefined;
    if (end !== undefined && end < start) {
      setError('End date can’t be before the start date.');
      return;
    }

    setSubmitting(true);
    await onSubmit({
      type,
      amount: parsedAmount,
      currency,
      category: initialCategory,
      note: note || undefined,
      frequency,
      dayOfMonth: frequency === 'monthly' || frequency === 'yearly' ? Number(dayOfMonth) : undefined,
      dayOfWeek: frequency === 'weekly' ? Number(dayOfWeek) : undefined,
      startDate: start,
      endDate: end,
      isActive,
    });
    setSubmitting(false);
  }

  return (
    <Sheet open onClose={onCancel} variant="modal" labelledBy={titleId}>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
          <h2 id={titleId} className="text-title">
            {initialValues ? 'Edit recurring' : 'New recurring item'}
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
              value={initialCategory}
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

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-label">
              Frequency
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RecurringRule['frequency'])}
                className={fieldClass}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>

            {frequency === 'weekly' && (
              <label className="flex flex-1 flex-col gap-1 text-label">
                On
                <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} className={fieldClass}>
                  {WEEKDAYS.map((day, i) => (
                    <option key={day} value={i}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {(frequency === 'monthly' || frequency === 'yearly') && (
              <label className="flex w-28 flex-col gap-1 text-label">
                Day of month
                <input
                  inputMode="numeric"
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                  className={`${fieldClass} tabular-nums`}
                />
              </label>
            )}
          </div>

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-label">
              Starts
              <input
                required
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-label">
              Ends (optional)
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={fieldClass}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-label">
            Note (optional)
            <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldClass} />
          </label>

          <label className="flex items-center gap-2 text-label">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Active — generate transactions automatically
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
