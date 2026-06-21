'use client';

import { useId, useState } from 'react';
import type { AssetLiabilitySnapshot } from '@/lib/db/schema';
import { Sheet } from '@/components/ui/Sheet';
import { AmountInput } from '@/components/ui/AmountInput';
import { FormError, RequiredMark } from '@/components/ui/form';
import { fieldClass, primaryButton, secondaryButton } from '@/components/ui/controls';

export type SnapshotFormValues = Pick<
  AssetLiabilitySnapshot,
  'name' | 'kind' | 'amount' | 'currency'
>;

export function SnapshotForm({
  initialValues,
  onSubmit,
  onCancel,
}: {
  initialValues?: AssetLiabilitySnapshot;
  onSubmit: (values: SnapshotFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [kind, setKind] = useState<'asset' | 'liability'>(initialValues?.kind ?? 'asset');
  const [amount, setAmount] = useState<number | null>(initialValues?.amount ?? null);
  const [currency, setCurrency] = useState(initialValues?.currency ?? 'IDR');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const errorId = useId();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Give it a name.');
      return;
    }
    if (amount === null || amount < 0) {
      setError('Enter a balance of zero or more.');
      return;
    }
    setSubmitting(true);
    await onSubmit({ name: name.trim(), kind, amount, currency });
    setSubmitting(false);
  }

  return (
    <Sheet open onClose={onCancel} variant="modal" labelledBy={titleId}>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
          <h2 id={titleId} className="text-title">
            {initialValues ? 'Edit balance' : 'Add a balance'}
          </h2>

          <div className="flex gap-2">
            {(['asset', 'liability'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={`flex-1 min-h-11 rounded-control border px-3 py-2.5 text-label capitalize transition-colors duration-150 ease-out-quart ${
                  kind === k
                    ? 'border-accent bg-accent text-accent-foreground hover:bg-accent-hover active:bg-accent-active'
                    : 'border-border text-muted hover:border-accent hover:text-foreground active:bg-surface-hover'
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-1 text-label">
            <span>
              Name
              <RequiredMark />
            </span>
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="e.g. BCA Savings, Car Loan"
              className={fieldClass}
            />
          </label>

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-label">
              <span>
                Current balance
                <RequiredMark />
              </span>
              <AmountInput
                required
                initialValue={initialValues?.amount}
                onValueChange={setAmount}
                aria-invalid={error != null && (amount === null || amount < 0)}
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
