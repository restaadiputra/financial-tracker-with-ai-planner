'use client';

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useVault } from '@/lib/vault/VaultContext';
import { db } from '@/lib/db/db';
import type { Budget } from '@/lib/db/schema';
import { listTransactions } from '@/lib/db/transactions';
import { budgets as budgetStore } from '@/lib/db/budgets';
import { currentMonthRange, spentInCategory } from '@/lib/finance/calculations';
import { formatMoney } from '@/lib/finance/format';
import { BudgetForm, type BudgetFormValues } from '@/components/budgets/BudgetForm';
import { primaryButton, ghostButton } from '@/components/ui/controls';

export default function BudgetsPage() {
  const { activeProfile, vaultKey } = useVault();
  const profileId = activeProfile!.id;
  const key = vaultKey!;

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  // Budgets only ever target spending, so offer expense + both categories.
  const categories = useLiveQuery(
    () =>
      db.categories
        .where('profileId')
        .equals(profileId)
        .filter((c) => c.type === 'expense' || c.type === 'both')
        .toArray(),
    [profileId]
  );
  const budgets = useLiveQuery(() => budgetStore.list(db, key, profileId), [profileId, key]);
  const transactions = useLiveQuery(() => listTransactions(db, key, profileId), [profileId, key]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories ?? []) map.set(c.id, c.name);
    return map;
  }, [categories]);

  const range = useMemo(() => currentMonthRange(), []);

  async function handleAdd(values: BudgetFormValues) {
    await budgetStore.add(db, key, profileId, values);
    setAdding(false);
  }

  async function handleEdit(values: BudgetFormValues) {
    if (!editing) return;
    await budgetStore.update(db, key, editing.id, values);
    setEditing(null);
  }

  async function handleDelete(id: string) {
    await budgetStore.remove(db, id);
    setConfirmingDelete(null);
  }

  const budgetList = budgets ?? [];
  const monthLabel = new Date(range.start).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-title">Budgets</h1>
          <p className="mt-1 text-label text-muted">Monthly envelopes &mdash; {monthLabel}.</p>
        </div>
        <button onClick={() => setAdding(true)} className={primaryButton}>
          New budget
        </button>
      </header>

      {budgetList.length === 0 ? (
        <p className="rounded-callout border border-dashed border-border px-4 py-10 text-center text-muted">
          No budgets yet. Set a monthly limit for a category to track spending against it.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {budgetList.map((b) => {
            const spent = spentInCategory(transactions ?? [], b.categoryId, b.currency, range);
            const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
            const over = spent > b.amount;
            const nearing = !over && pct >= b.alertThresholdPct;
            const barColor = over ? 'bg-danger' : nearing ? 'bg-danger/70' : 'bg-accent';
            const remaining = b.amount - spent;

            return (
              <li key={b.id} className="rounded-card border border-border bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {categoryNameById.get(b.categoryId) ?? 'Unknown category'}
                    </p>
                    <p className="text-label text-muted">
                      <span className="tabular-nums">{formatMoney(b.currency, spent)}</span> of{' '}
                      <span className="tabular-nums">{formatMoney(b.currency, b.amount)}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {confirmingDelete === b.id ? (
                      <>
                        <button onClick={() => setConfirmingDelete(null)} className={ghostButton}>
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(b.id)}
                          className="rounded-control px-2 py-1.5 text-label font-medium text-danger transition-colors duration-150 ease-out-quart hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setEditing(b)} className={ghostButton}>
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirmingDelete(b.id)}
                          className="rounded-control px-2 py-1.5 text-label text-muted transition-colors duration-150 ease-out-quart hover:bg-surface-hover hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div
                  className="mt-3 h-2 overflow-hidden rounded-full bg-background"
                  role="progressbar"
                  aria-valuenow={Math.round(pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 ease-out-quart ${barColor}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>

                <p className={`mt-2 text-label ${over ? 'text-danger' : nearing ? 'text-danger/80' : 'text-muted'}`}>
                  {over
                    ? `Over budget by ${formatMoney(b.currency, -remaining)}`
                    : nearing
                      ? `${Math.round(pct)}% spent — ${formatMoney(b.currency, remaining)} left`
                      : `${formatMoney(b.currency, remaining)} left this month`}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {adding && (
        <BudgetForm categories={categories ?? []} onSubmit={handleAdd} onCancel={() => setAdding(false)} />
      )}
      {editing && (
        <BudgetForm
          key={editing.id}
          categories={categories ?? []}
          initialValues={editing}
          onSubmit={handleEdit}
          onCancel={() => setEditing(null)}
        />
      )}
    </main>
  );
}
