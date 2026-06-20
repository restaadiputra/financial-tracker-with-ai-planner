'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { useVault } from '@/lib/vault/VaultContext';
import { db } from '@/lib/db/db';
import type { Transaction } from '@/lib/db/schema';
import { addTransaction, deleteTransaction, listTransactions, updateTransaction } from '@/lib/db/transactions';
import { TransactionForm, type TransactionFormValues } from '@/components/transactions/TransactionForm';

export default function DashboardPage() {
  const { activeProfile, vaultKey, lock } = useVault();
  const router = useRouter();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const categories = useLiveQuery(
    () => (activeProfile ? db.categories.where('profileId').equals(activeProfile.id).toArray() : []),
    [activeProfile?.id]
  );

  const transactions = useLiveQuery(
    () => (activeProfile && vaultKey ? listTransactions(db, vaultKey, activeProfile.id) : Promise.resolve([])),
    [activeProfile?.id, vaultKey]
  );

  const totalsByCurrency = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of transactions ?? []) {
      const signed = t.type === 'income' ? t.amount : -t.amount;
      totals.set(t.currency, (totals.get(t.currency) ?? 0) + signed);
    }
    return Array.from(totals.entries());
  }, [transactions]);

  useEffect(() => {
    if (!activeProfile || !vaultKey) {
      router.replace('/');
    }
  }, [activeProfile, vaultKey, router]);

  if (!activeProfile || !vaultKey) {
    return null;
  }

  async function handleAdd(values: TransactionFormValues) {
    await addTransaction(db, vaultKey!, activeProfile!.id, values);
    setFormOpen(false);
  }

  async function handleEdit(values: TransactionFormValues) {
    if (!editing) return;
    await updateTransaction(db, vaultKey!, editing.id, values);
    setEditing(null);
  }

  async function handleDelete(id: string) {
    await deleteTransaction(db, id);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">Welcome back</p>
          <h1 className="text-2xl font-semibold tracking-tight">{activeProfile.displayName}</h1>
        </div>
        <button onClick={lock} className="text-sm text-muted hover:text-foreground">
          Switch profile
        </button>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-sm font-medium text-muted">Running total</h2>
        <p className="mt-1 text-xs text-muted">Totals shown per currency &mdash; no automatic conversion.</p>
        <div className="mt-4 flex flex-wrap gap-6">
          {totalsByCurrency.length === 0 && <p className="text-muted">No transactions yet.</p>}
          {totalsByCurrency.map(([currency, total]) => (
            <div key={currency}>
              <p className="text-xs uppercase tracking-wide text-muted">Total {currency}</p>
              <p className="text-2xl font-semibold tabular-nums">
                {total < 0 ? '-' : ''}
                {currency} {Math.abs(total).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Transactions</h2>
          <button
            onClick={() => setFormOpen(true)}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"
          >
            Add transaction
          </button>
        </div>

        {(transactions ?? []).length === 0 && (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-muted">
            No transactions yet. Add your first one above.
          </p>
        )}

        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
          {(transactions ?? []).map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="font-medium">{categories?.find((c) => c.id === t.category)?.name ?? t.category}</p>
                <p className="text-sm text-muted">
                  {new Date(t.date).toLocaleDateString()} {t.note ? `· ${t.note}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className={`tabular-nums font-medium ${t.type === 'income' ? 'text-accent' : ''}`}>
                  {t.type === 'income' ? '+' : '-'}
                  {t.currency} {t.amount.toLocaleString()}
                </p>
                <button onClick={() => setEditing(t)} className="text-sm text-muted hover:text-foreground">
                  Edit
                </button>
                <button onClick={() => handleDelete(t.id)} className="text-sm text-muted hover:text-danger">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
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
          categories={categories ?? []}
          initialValues={editing}
          onSubmit={handleEdit}
          onCancel={() => setEditing(null)}
        />
      )}
    </main>
  );
}
