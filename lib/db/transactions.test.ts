import { describe, expect, test } from 'vitest';
import { FinanceTrackerDB } from './db';
import { deriveKeyFromPassword, generateSalt } from '@/lib/crypto/deriveKey';
import { addTransaction, deleteTransaction, listTransactions, updateTransaction } from './transactions';

function freshDb() {
  return new FinanceTrackerDB(`test-db-${crypto.randomUUID()}`);
}

async function testKey() {
  return deriveKeyFromPassword('correct-horse', generateSalt());
}

describe('addTransaction / listTransactions', () => {
  test('stores the transaction encrypted, but the date unencrypted for querying', async () => {
    const db = freshDb();
    const key = await testKey();

    await addTransaction(db, key, 'profile-1', {
      type: 'expense',
      amount: 50000,
      currency: 'IDR',
      category: 'food',
      date: new Date('2026-06-01').getTime(),
    });

    const raw = await db.transactions.toArray();
    expect(raw).toHaveLength(1);
    expect(raw[0].profileId).toBe('profile-1');
    expect(raw[0].date).toBe(new Date('2026-06-01').getTime());
    expect(raw[0].encryptedPayload).not.toContain('50000');
    expect(raw[0].encryptedPayload).not.toContain('food');
  });

  test('listTransactions decrypts and returns transactions scoped to the profile, newest first', async () => {
    const db = freshDb();
    const key = await testKey();

    await addTransaction(db, key, 'profile-1', {
      type: 'expense',
      amount: 10000,
      currency: 'IDR',
      category: 'food',
      date: new Date('2026-06-01').getTime(),
    });
    await addTransaction(db, key, 'profile-1', {
      type: 'income',
      amount: 5_000_000,
      currency: 'IDR',
      category: 'salary',
      date: new Date('2026-06-10').getTime(),
    });
    await addTransaction(db, key, 'profile-2', {
      type: 'expense',
      amount: 99,
      currency: 'USD',
      category: 'other',
      date: new Date('2026-06-05').getTime(),
    });

    const transactions = await listTransactions(db, key, 'profile-1');
    expect(transactions).toHaveLength(2);
    expect(transactions[0].amount).toBe(5_000_000);
    expect(transactions[1].amount).toBe(10000);
  });
});

describe('updateTransaction', () => {
  test('re-encrypts the payload with the new fields', async () => {
    const db = freshDb();
    const key = await testKey();

    const created = await addTransaction(db, key, 'profile-1', {
      type: 'expense',
      amount: 10000,
      currency: 'IDR',
      category: 'food',
      date: new Date('2026-06-01').getTime(),
    });

    await updateTransaction(db, key, created.id, { amount: 20000, note: 'lunch' });

    const [updated] = await listTransactions(db, key, 'profile-1');
    expect(updated.amount).toBe(20000);
    expect(updated.note).toBe('lunch');
  });
});

describe('deleteTransaction', () => {
  test('removes the record', async () => {
    const db = freshDb();
    const key = await testKey();

    const created = await addTransaction(db, key, 'profile-1', {
      type: 'expense',
      amount: 10000,
      currency: 'IDR',
      category: 'food',
      date: new Date('2026-06-01').getTime(),
    });

    await deleteTransaction(db, created.id);
    const transactions = await listTransactions(db, key, 'profile-1');
    expect(transactions).toHaveLength(0);
  });
});
