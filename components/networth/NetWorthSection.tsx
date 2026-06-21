'use client';

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/db';
import type { AssetLiabilitySnapshot, Transaction } from '@/lib/db/schema';
import { snapshots as snapshotStore } from '@/lib/db/snapshots';
import { netWorthByCurrency } from '@/lib/finance/calculations';
import { formatMoney } from '@/lib/finance/format';
import { ghostButton } from '@/components/ui/controls';
import { SnapshotForm, type SnapshotFormValues } from './SnapshotForm';

// Net worth is derived, never stored (PRD 5.6): income − expense from transactions,
// plus manual asset/liability snapshots, computed and shown per currency (PRD 5.7).
export function NetWorthSection({
  profileId,
  vaultKey,
  transactions,
}: {
  profileId: string;
  vaultKey: CryptoKey;
  transactions: Transaction[];
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AssetLiabilitySnapshot | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const snapshots = useLiveQuery(
    () => snapshotStore.list(db, vaultKey, profileId),
    [profileId, vaultKey]
  );

  const netWorth = useMemo(
    () => Array.from(netWorthByCurrency(transactions, snapshots ?? []).entries()),
    [transactions, snapshots]
  );

  async function handleAdd(values: SnapshotFormValues) {
    await snapshotStore.add(db, vaultKey, profileId, values);
    setAdding(false);
  }

  async function handleEdit(values: SnapshotFormValues) {
    if (!editing) return;
    await snapshotStore.update(db, vaultKey, editing.id, { ...values, updatedAt: Date.now() });
    setEditing(null);
  }

  async function handleDelete(id: string) {
    await snapshotStore.remove(db, id);
    setConfirmingDelete(null);
  }

  const snapList = snapshots ?? [];

  return (
    <section className="rounded-card border border-border bg-surface p-5 sm:p-6">
      <h2 className="text-label text-muted">Net worth</h2>
      <p className="mt-1 text-micro-label text-muted">
        Transactions plus manual balances &mdash; per currency, no automatic conversion.
      </p>

      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-4">
        {netWorth.length === 0 && <p className="text-muted">Nothing tracked yet.</p>}
        {netWorth.map(([currency, total]) => (
          <div key={currency}>
            <p className="text-micro-label uppercase tracking-wide text-muted">Net {currency}</p>
            <p className="text-amount tabular-nums">{formatMoney(currency, total)}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-label font-medium">Assets &amp; liabilities</h3>
          <button onClick={() => setAdding(true)} className={ghostButton}>
            + Add balance
          </button>
        </div>

        {snapList.length === 0 ? (
          <p className="mt-3 text-label text-muted">
            Add savings, cash, or loans that aren&apos;t captured by your transactions.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {snapList.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-label font-medium">{s.name}</p>
                  <p className="text-micro-label uppercase tracking-wide text-muted">{s.kind}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="tabular-nums text-label font-medium">
                    {s.kind === 'liability' ? '-' : ''}
                    {formatMoney(s.currency, s.amount)}
                  </p>
                  {confirmingDelete === s.id ? (
                    <>
                      <button onClick={() => setConfirmingDelete(null)} className={ghostButton}>
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="inline-flex min-h-11 items-center justify-center rounded-control px-2 py-1.5 text-label font-medium text-danger transition-colors duration-150 ease-out-quart hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setEditing(s)} className={ghostButton}>
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmingDelete(s.id)}
                        className="inline-flex min-h-11 items-center justify-center rounded-control px-2 py-1.5 text-label text-muted transition-colors duration-150 ease-out-quart hover:bg-surface-hover hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {adding && <SnapshotForm onSubmit={handleAdd} onCancel={() => setAdding(false)} />}
      {editing && (
        <SnapshotForm
          key={editing.id}
          initialValues={editing}
          onSubmit={handleEdit}
          onCancel={() => setEditing(null)}
        />
      )}
    </section>
  );
}
