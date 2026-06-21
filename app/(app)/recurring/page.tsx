'use client';

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useVault } from '@/lib/vault/VaultContext';
import { db } from '@/lib/db/db';
import type { RecurringRule } from '@/lib/db/schema';
import { recurringRules as ruleStore } from '@/lib/db/recurringRules';
import { generateDueTransactions } from '@/lib/recurring/generateDueTransactions';
import { formatMoney } from '@/lib/finance/format';
import { RecurringForm, type RecurringFormValues } from '@/components/recurring/RecurringForm';
import { primaryButton, ghostButton } from '@/components/ui/controls';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function describeSchedule(rule: RecurringRule): string {
  switch (rule.frequency) {
    case 'daily':
      return 'Every day';
    case 'weekly':
      return `Every ${WEEKDAYS[rule.dayOfWeek ?? 0]}`;
    case 'monthly':
      return `Monthly on day ${rule.dayOfMonth ?? 1}`;
    case 'yearly':
      return `Yearly on day ${rule.dayOfMonth ?? 1}`;
  }
}

export default function RecurringPage() {
  const { activeProfile, vaultKey } = useVault();
  const profileId = activeProfile!.id;
  const key = vaultKey!;

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<RecurringRule | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const categories = useLiveQuery(
    () => db.categories.where('profileId').equals(profileId).toArray(),
    [profileId]
  );
  const rules = useLiveQuery(() => ruleStore.list(db, key, profileId), [profileId, key]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories ?? []) map.set(c.id, c.name);
    return map;
  }, [categories]);

  async function handleAdd(values: RecurringFormValues) {
    await ruleStore.add(db, key, profileId, values);
    // Catch up any occurrences already due (e.g. a rule starting in the past).
    await generateDueTransactions(db, key, profileId);
    setAdding(false);
  }

  async function handleEdit(values: RecurringFormValues) {
    if (!editing) return;
    await ruleStore.update(db, key, editing.id, values);
    await generateDueTransactions(db, key, profileId);
    setEditing(null);
  }

  async function handleToggleActive(rule: RecurringRule) {
    await ruleStore.update(db, key, rule.id, { isActive: !rule.isActive });
    if (!rule.isActive) await generateDueTransactions(db, key, profileId);
  }

  async function handleDelete(id: string) {
    await ruleStore.remove(db, id);
    setConfirmingDelete(null);
  }

  const ruleList = rules ?? [];

  return (
    // SIMPLICITY NOTE: see app/(app)/dashboard/page.tsx — the max-w-2xl cap is a
    // deliberate "focused single-column list" choice, not an unfinished desktop
    // layout. Recurring rule cards don't benefit from a wider desktop grid.
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-title">Recurring</h1>
          <p className="mt-1 text-label text-muted">
            Subscriptions and regular income. Transactions are created automatically when due.
          </p>
        </div>
        <button onClick={() => setAdding(true)} className={primaryButton}>
          New recurring
        </button>
      </header>

      {ruleList.length === 0 ? (
        <p className="rounded-callout border border-dashed border-border px-4 py-10 text-center text-muted">
          No recurring items yet. Add a subscription or a regular paycheck to track it automatically.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {ruleList.map((rule) => (
            <li key={rule.id} className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {categoryNameById.get(rule.category) ?? rule.category}
                  {rule.note ? <span className="text-muted"> · {rule.note}</span> : ''}
                  {!rule.isActive && (
                    <span className="ml-2 align-middle text-micro-label uppercase tracking-wide text-muted">
                      Paused
                    </span>
                  )}
                </p>
                <p className="text-label text-muted">{describeSchedule(rule)}</p>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <p className={`tabular-nums font-medium ${rule.type === 'income' ? 'text-accent' : ''}`}>
                  {rule.type === 'income' ? '+' : '-'}
                  {formatMoney(rule.currency, rule.amount)}
                </p>
                <div className="flex items-center gap-1">
                  {confirmingDelete === rule.id ? (
                    <>
                      <button onClick={() => setConfirmingDelete(null)} className={ghostButton}>
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="inline-flex min-h-11 items-center justify-center rounded-control px-2 py-1.5 text-label font-medium text-danger transition-colors duration-150 ease-out-quart hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleToggleActive(rule)} className={ghostButton}>
                        {rule.isActive ? 'Pause' : 'Resume'}
                      </button>
                      <button onClick={() => setEditing(rule)} className={ghostButton}>
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmingDelete(rule.id)}
                        className="inline-flex min-h-11 items-center justify-center rounded-control px-2 py-1.5 text-label text-muted transition-colors duration-150 ease-out-quart hover:bg-surface-hover hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <RecurringForm categories={categories ?? []} onSubmit={handleAdd} onCancel={() => setAdding(false)} />
      )}
      {editing && (
        <RecurringForm
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
