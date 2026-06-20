import type { FinanceTrackerDB } from './db';
import { DEFAULT_CATEGORIES } from './schema';

export async function seedDefaultCategories(db: FinanceTrackerDB, profileId: string): Promise<void> {
  const existing = await db.categories.where('profileId').equals(profileId).count();
  if (existing > 0) return;

  await db.categories.bulkAdd(
    DEFAULT_CATEGORIES.map((category) => ({
      ...category,
      id: crypto.randomUUID(),
      profileId,
    }))
  );
}
