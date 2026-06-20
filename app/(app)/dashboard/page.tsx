'use client';

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useVault } from '@/lib/vault/VaultContext';
import { db } from '@/lib/db/db';
import type { Transaction } from '@/lib/db/schema';
import { addTransaction, deleteTransaction, listTransactions, updateTransaction } from '@/lib/db/transactions';
import { formatMoney } from '@/lib/finance/format';
import { TransactionForm, type TransactionFormValues } from '@/components/transactions/TransactionForm';
import { NetWorthSection } from '@/components/networth/NetWorthSection';
import { primaryButton, ghostButton, dangerButton } from '@/components/ui/controls';

export default function DashboardPage() {
  // The (app) layout guarantees an unlocked vault before rendering children.
  const { activeProfile, vaultKey } = useVault();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const profileId = activeProfile!.id;
  const key = vaultKey!;

  const categories = useLiveQuery(
    () => db.categories.where('profileId').equals(profileId).toArray(),
    [profileId]
  );

  const transactions = useLiveQuery(
    () => listTransactions(db, key, profileId),
    [profileId, key]
  );

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories ?? []) map.set(c.id, c.name);
    return map;
  }, [categories]);

  async function handleAdd(values: TransactionFormValues) {
    await addTransaction(db, key, profileId, values);
    setFormOpen(false);
  }

  async function handleEdit(values: TransactionFormValues) {
    if (!editing) return;
    await updateTransaction(db, key, editing.id, values);
    setEditing(null);
  }

  async function handleDelete(id: string) {
    await deleteTransaction(db, id);
    setConfirmingDelete(null);
  }

  const txList = transactions ?? [];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10">
      <header>
        <p className="text-label text-muted">Welcome back</p>
        <h1 className="truncate text-title tracking-tight">{activeProfile!.displayName}</h1>
      </header>

      <NetWorthSection profileId={profileId} vaultKey={key} transactions={txList} />

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-title">Transactions</h2>
          <button onClick={() => setFormOpen(true)} className={primaryButton}>
            Add transaction
          </button>
        </div>

        {txList.length === 0 ? (
          <p className="rounded-callout border border-dashed border-border px-4 py-10 text-center text-muted">
            No transactions yet. Add your first one above.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
            {txList.map((t) => (
              <li
                key={t.id}
                className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {categoryNameById.get(t.category) ?? t.category}
                    {t.recurringRuleId && (
                      <span className="ml-2 align-middle text-micro-label uppercase tracking-wide text-muted">
                        Recurring
                      </span>
                    )}
                  </p>
                  <p className="text-label text-muted">
                    {new Date(t.date).toLocaleDateString()} {t.note ? `· ${t.note}` : ''}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <p className={`tabular-nums font-medium ${t.type === 'income' ? 'text-accent' : ''}`}>
                    {t.type === 'income' ? '+' : '-'}
                    {formatMoney(t.currency, t.amount)}
                  </p>
                  {confirmingDelete === t.id ? (
                    <div className="flex items-center gap-1">
                      <span className="hidden text-label text-muted sm:inline">Delete?</span>
                      <button onClick={() => setConfirmingDelete(null)} className={ghostButton}>
                        Cancel
                      </button>
                      <button onClick={() => handleDelete(t.id)} className={dangerButton}>
                        Delete
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditing(t)} className={ghostButton}>
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmingDelete(t.id)}
                        className="rounded-control px-2 py-1.5 text-label text-muted transition-colors duration-150 ease-out-quart hover:bg-surface-hover hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {formOpen && (
        <TransactionForm
          categories={categories ?? []}
          onSubmit={handleAdd}
          onCancel={() => setFormOpen(false)}
        />
      )}

      {editing && (
        <TransactionForm
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
