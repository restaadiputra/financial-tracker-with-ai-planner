import type { FinanceTrackerDB } from './db';
import type { Transaction } from './schema';
import { decryptString, encryptString } from '@/lib/crypto/encrypt';

type NewTransaction = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>;

async function decryptRecord(key: CryptoKey, encryptedPayload: string, iv: string): Promise<Transaction> {
  const json = await decryptString(key, encryptedPayload, iv);
  return JSON.parse(json) as Transaction;
}

export async function addTransaction(
  db: FinanceTrackerDB,
  key: CryptoKey,
  profileId: string,
  input: NewTransaction
): Promise<Transaction> {
  const now = Date.now();
  const transaction: Transaction = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };

  const { ciphertext, iv } = await encryptString(key, JSON.stringify(transaction));
  await db.transactions.add({
    id: transaction.id,
    profileId,
    date: transaction.date,
    iv,
    encryptedPayload: ciphertext,
  });

  return transaction;
}

export async function listTransactions(
  db: FinanceTrackerDB,
  key: CryptoKey,
  profileId: string
): Promise<Transaction[]> {
  const records = await db.transactions.where('profileId').equals(profileId).toArray();
  const transactions = await Promise.all(
    records.map((record) => decryptRecord(key, record.encryptedPayload, record.iv))
  );
  return transactions.sort((a, b) => b.date - a.date);
}

export async function updateTransaction(
  db: FinanceTrackerDB,
  key: CryptoKey,
  id: string,
  patch: Partial<NewTransaction>
): Promise<void> {
  const record = await db.transactions.get(id);
  if (!record) return;

  const current = await decryptRecord(key, record.encryptedPayload, record.iv);
  const updated: Transaction = { ...current, ...patch, updatedAt: Date.now() };

  const { ciphertext, iv } = await encryptString(key, JSON.stringify(updated));
  await db.transactions.update(id, {
    date: updated.date,
    iv,
    encryptedPayload: ciphertext,
  });
}

export async function deleteTransaction(db: FinanceTrackerDB, id: string): Promise<void> {
  await db.transactions.delete(id);
}
