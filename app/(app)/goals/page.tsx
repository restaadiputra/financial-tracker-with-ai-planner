'use client';

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useVault } from '@/lib/vault/VaultContext';
import { db } from '@/lib/db/db';
import type { Goal } from '@/lib/db/schema';
import { listTransactions } from '@/lib/db/transactions';
import { goals as goalStore } from '@/lib/db/goals';
import { goalProgress } from '@/lib/finance/calculations';
import { formatMoney } from '@/lib/finance/format';
import { GoalForm, type GoalFormValues } from '@/components/goals/GoalForm';
import { primaryButton, ghostButton } from '@/components/ui/controls';

function daysUntil(target: number): number {
  return Math.ceil((target - Date.now()) / 86_400_000);
}

export default function GoalsPage() {
  const { activeProfile, vaultKey } = useVault();
  const profileId = activeProfile!.id;
  const key = vaultKey!;

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const categories = useLiveQuery(
    () => db.categories.where('profileId').equals(profileId).toArray(),
    [profileId]
  );
  const goals = useLiveQuery(() => goalStore.list(db, key, profileId), [profileId, key]);
  const transactions = useLiveQuery(() => listTransactions(db, key, profileId), [profileId, key]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories ?? []) map.set(c.id, c.name);
    return map;
  }, [categories]);

  async function handleAdd(values: GoalFormValues) {
    await goalStore.add(db, key, profileId, values);
    setAdding(false);
  }

  async function handleEdit(values: GoalFormValues) {
    if (!editing) return;
    await goalStore.update(db, key, editing.id, values);
    setEditing(null);
  }

  async function handleDelete(id: string) {
    await goalStore.remove(db, id);
    setConfirmingDelete(null);
  }

  const goalList = goals ?? [];

  return (
    // SIMPLICITY NOTE: see app/(app)/dashboard/page.tsx — the max-w-2xl cap is a
    // deliberate "focused single-column list" choice, not an unfinished desktop
    // layout. Goal progress cards don't benefit from a wider desktop grid.
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-title">Goals</h1>
          <p className="mt-1 text-label text-muted">Savings targets and debt payoff.</p>
        </div>
        <button onClick={() => setAdding(true)} className={primaryButton}>
          New goal
        </button>
      </header>

      {goalList.length === 0 ? (
        <p className="rounded-callout border border-dashed border-border px-4 py-10 text-center text-muted">
          No goals yet. Set a savings target or a debt to pay off and track your progress.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {goalList.map((goal) => {
            const current = goalProgress(goal, transactions ?? []);
            const pct = goal.targetAmount > 0 ? (current / goal.targetAmount) * 100 : 0;
            const reached = current >= goal.targetAmount;
            const days = goal.targetDate ? daysUntil(goal.targetDate) : null;

            return (
              <li key={goal.id} className="rounded-card border border-border bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{goal.name}</p>
                    <p className="text-label text-muted">
                      <span className="tabular-nums">{formatMoney(goal.currency, current)}</span> of{' '}
                      <span className="tabular-nums">{formatMoney(goal.currency, goal.targetAmount)}</span>
                      {goal.linkedCategoryId && (
                        <span> · auto from {categoryNameById.get(goal.linkedCategoryId) ?? 'category'}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {confirmingDelete === goal.id ? (
                      <>
                        <button onClick={() => setConfirmingDelete(null)} className={ghostButton}>
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(goal.id)}
                          className="inline-flex min-h-11 items-center justify-center rounded-control px-2 py-1.5 text-label font-medium text-danger transition-colors duration-150 ease-out-quart hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setEditing(goal)} className={ghostButton}>
                          {goal.linkedCategoryId ? 'Edit' : 'Update'}
                        </button>
                        <button
                          onClick={() => setConfirmingDelete(goal.id)}
                          className="inline-flex min-h-11 items-center justify-center rounded-control px-2 py-1.5 text-label text-muted transition-colors duration-150 ease-out-quart hover:bg-surface-hover hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
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
                  aria-valuenow={Math.round(Math.min(pct, 100))}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out-quart"
                    style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
                  />
                </div>

                <p className="mt-2 text-label text-muted">
                  {reached ? (
                    <span className="text-accent">Goal reached 🎉</span>
                  ) : (
                    `${Math.round(pct)}% there`
                  )}
                  {days !== null && !reached && (
                    <span> · {days > 0 ? `${days} days left` : 'past target date'}</span>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {adding && (
        <GoalForm categories={categories ?? []} onSubmit={handleAdd} onCancel={() => setAdding(false)} />
      )}
      {editing && (
        <GoalForm
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
