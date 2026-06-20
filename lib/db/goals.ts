import type { Goal } from './schema';
import { createEncryptedStore } from './encryptedStore';

export type NewGoal = Omit<Goal, 'id' | 'createdAt'>;

export const goals = createEncryptedStore<Goal, NewGoal>(
  (db) => db.goals,
  (input) => ({ ...input, id: crypto.randomUUID(), createdAt: Date.now() })
);
