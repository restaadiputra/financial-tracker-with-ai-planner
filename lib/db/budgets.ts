import type { Budget } from './schema';
import { createEncryptedStore } from './encryptedStore';

export type NewBudget = Omit<Budget, 'id' | 'createdAt'>;

export const budgets = createEncryptedStore<Budget, NewBudget>(
  (db) => db.budgets,
  (input) => ({ ...input, id: crypto.randomUUID(), createdAt: Date.now() })
);
