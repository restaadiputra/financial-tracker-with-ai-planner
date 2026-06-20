import type { RecurringRule } from './schema';
import { createEncryptedStore } from './encryptedStore';

export type NewRecurringRule = Omit<RecurringRule, 'id' | 'lastGeneratedDate'>;

export const recurringRules = createEncryptedStore<RecurringRule, NewRecurringRule>(
  (db) => db.recurringRules,
  (input) => ({ ...input, id: crypto.randomUUID() })
);
