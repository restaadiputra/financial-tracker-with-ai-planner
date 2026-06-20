import Dexie, { type EntityTable } from 'dexie';
import type { CategoryRecord, Profile, TransactionRecord } from './schema';

export class FinanceTrackerDB extends Dexie {
  profiles!: EntityTable<Profile, 'id'>;
  transactions!: EntityTable<TransactionRecord, 'id'>;
  categories!: EntityTable<CategoryRecord, 'id'>;

  constructor(name = 'FinanceTrackerDB') {
    super(name);
    this.version(1).stores({
      profiles: 'id, emailHash',
      transactions: 'id, profileId, date, [profileId+date]',
      categories: 'id, profileId',
    });
  }
}

export const db = new FinanceTrackerDB();
