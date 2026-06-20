import type { AssetLiabilitySnapshot } from './schema';
import { createEncryptedStore } from './encryptedStore';

export type NewSnapshot = Omit<AssetLiabilitySnapshot, 'id' | 'updatedAt'>;

export const snapshots = createEncryptedStore<AssetLiabilitySnapshot, NewSnapshot>(
  (db) => db.snapshots,
  (input) => ({ ...input, id: crypto.randomUUID(), updatedAt: Date.now() })
);
