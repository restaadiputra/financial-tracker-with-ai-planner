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

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories ?? []) {
      map.set(c.id, c.name);
    }
    return map;
  }, [categories]);

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
          <p className="text-label text-muted">Welcome back</p>
          <h1 className="text-title tracking-tight">{activeProfile.displayName}</h1>
        </div>
        <button
          onClick={lock}
          className="text-label text-muted transition-colors duration-150 ease-out-quart hover:text-foreground active:text-foreground/70"
        >
          Switch profile
        </button>
      </header>

      <section className="rounded-card border border-border bg-surface p-6">
        <h2 className="text-label text-muted">Running total</h2>
        <p className="mt-1 text-micro-label text-muted">Totals shown per currency &mdash; no automatic conversion.</p>
        <div className="mt-4 flex flex-wrap gap-6">
          {totalsByCurrency.length === 0 && <p className="text-muted">No transactions yet.</p>}
          {totalsByCurrency.map(([currency, total]) => (
            <div key={currency}>
              <p className="text-micro-label uppercase tracking-wide text-muted">Total {currency}</p>
              <p className="text-amount tabular-nums">
                {total < 0 ? '-' : ''}
                {currency} {Math.abs(total).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-title">Transactions</h2>
          <button
            onClick={() => setFormOpen(true)}
            className="rounded-control bg-accent px-3 py-1.5 text-label text-accent-foreground transition-colors duration-150 ease-out-quart hover:bg-accent-hover active:bg-accent-active"
          >
            Add transaction
          </button>
        </div>

        {(transactions ?? []).length === 0 && (
          <p className="rounded-callout border border-dashed border-border px-4 py-8 text-center text-muted">
            No transactions yet. Add your first one above.
          </p>
        )}

        <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
          {(transactions ?? []).map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="font-medium">{categoryNameById.get(t.category) ?? t.category}</p>
                <p className="text-label text-muted">
                  {new Date(t.date).toLocaleDateString()} {t.note ? `· ${t.note}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className={`tabular-nums font-medium ${t.type === 'income' ? 'text-accent' : ''}`}>
                  {t.type === 'income' ? '+' : '-'}
                  {t.currency} {t.amount.toLocaleString()}
                </p>
                <button
                  onClick={() => setEditing(t)}
                  className="text-label text-muted transition-colors duration-150 ease-out-quart hover:text-foreground active:text-foreground/70"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="text-label text-muted transition-colors duration-150 ease-out-quart hover:text-danger active:text-danger/70"
                >
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
