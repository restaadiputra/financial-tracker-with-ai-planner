import Dexie, { type EntityTable } from 'dexie';
import type { CategoryRecord, EncryptedRecord, Profile, TransactionRecord } from './schema';

// The Phase 2 financial tables all store an EncryptedRecord shape on disk; their
// decrypted types (Budget/RecurringRule/Goal/AssetLiabilitySnapshot) are only ever
// seen in memory after decryption, never by Dexie.
export class FinanceTrackerDB extends Dexie {
  profiles!: EntityTable<Profile, 'id'>;
  transactions!: EntityTable<TransactionRecord, 'id'>;
  categories!: EntityTable<CategoryRecord, 'id'>;
  budgets!: EntityTable<EncryptedRecord, 'id'>;
  recurringRules!: EntityTable<EncryptedRecord, 'id'>;
  goals!: EntityTable<EncryptedRecord, 'id'>;
  snapshots!: EntityTable<EncryptedRecord, 'id'>;

  constructor(name = 'FinanceTrackerDB') {
    super(name);
    this.version(1).stores({
      profiles: 'id, emailHash',
      transactions: 'id, profileId, date, [profileId+date]',
      categories: 'id, profileId',
    });
    // Phase 2: budgets, recurring rules, goals, asset/liability snapshots. Only
    // `profileId` is indexed — these tables are small enough to decrypt wholesale.
    this.version(2).stores({
      budgets: 'id, profileId',
      recurringRules: 'id, profileId',
      goals: 'id, profileId',
      snapshots: 'id, profileId',
    });
  }
}

export const db = new FinanceTrackerDB();
