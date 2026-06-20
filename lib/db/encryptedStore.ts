import type { EntityTable } from 'dexie';
import type { FinanceTrackerDB } from './db';
import type { EncryptedRecord } from './schema';
import { decryptString, encryptString } from '@/lib/crypto/encrypt';

// Shared CRUD for the Phase 2 tables whose on-disk shape is a profile-scoped
// EncryptedRecord (budgets, recurringRules, goals, snapshots). transactions.ts
// stays hand-written because it additionally keeps `date` unencrypted for indexed
// range queries — these tables don't, so one generic store covers them all.

async function toRecord<T extends { id: string }>(
  key: CryptoKey,
  profileId: string,
  value: T
): Promise<EncryptedRecord> {
  const { ciphertext, iv } = await encryptString(key, JSON.stringify(value));
  return { id: value.id, profileId, iv, encryptedPayload: ciphertext };
}

async function fromRecord<T>(key: CryptoKey, record: EncryptedRecord): Promise<T> {
  return JSON.parse(await decryptString(key, record.encryptedPayload, record.iv)) as T;
}

export interface EncryptedStore<T extends { id: string }, NewT> {
  add(db: FinanceTrackerDB, key: CryptoKey, profileId: string, input: NewT): Promise<T>;
  list(db: FinanceTrackerDB, key: CryptoKey, profileId: string): Promise<T[]>;
  update(db: FinanceTrackerDB, key: CryptoKey, id: string, patch: Partial<T>): Promise<void>;
  remove(db: FinanceTrackerDB, id: string): Promise<void>;
}

export function createEncryptedStore<T extends { id: string }, NewT>(
  selectTable: (db: FinanceTrackerDB) => EntityTable<EncryptedRecord, 'id'>,
  init: (input: NewT) => T
): EncryptedStore<T, NewT> {
  return {
    async add(db, key, profileId, input) {
      const value = init(input);
      await selectTable(db).add(await toRecord(key, profileId, value));
      return value;
    },
    async list(db, key, profileId) {
      const records = await selectTable(db).where('profileId').equals(profileId).toArray();
      return Promise.all(records.map((record) => fromRecord<T>(key, record)));
    },
    async update(db, key, id, patch) {
      const record = await selectTable(db).get(id);
      if (!record) return;
      const current = await fromRecord<T>(key, record);
      const updated = { ...current, ...patch };
      await selectTable(db).update(id, await toRecord(key, record.profileId, updated));
    },
    async remove(db, id) {
      await selectTable(db).delete(id);
    },
  };
}
