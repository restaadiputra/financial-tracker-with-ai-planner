import { describe, expect, test } from 'vitest';
import { FinanceTrackerDB } from './db';
import { DEFAULT_CATEGORIES } from './schema';
import { seedDefaultCategories } from './categories';

function freshDb() {
  return new FinanceTrackerDB(`test-db-${crypto.randomUUID()}`);
}

describe('seedDefaultCategories', () => {
  test('inserts the default category list scoped to the given profile', async () => {
    const db = freshDb();
    await seedDefaultCategories(db, 'profile-1');

    const stored = await db.categories.where('profileId').equals('profile-1').toArray();
    expect(stored).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(stored.every((c) => c.profileId === 'profile-1')).toBe(true);
    expect(stored.map((c) => c.name)).toContain('Food');
  });

  test('does not duplicate categories if called twice for the same profile', async () => {
    const db = freshDb();
    await seedDefaultCategories(db, 'profile-1');
    await seedDefaultCategories(db, 'profile-1');

    const stored = await db.categories.where('profileId').equals('profile-1').toArray();
    expect(stored).toHaveLength(DEFAULT_CATEGORIES.length);
  });

  test('scopes categories independently per profile', async () => {
    const db = freshDb();
    await seedDefaultCategories(db, 'profile-1');
    await seedDefaultCategories(db, 'profile-2');

    const profile1Categories = await db.categories.where('profileId').equals('profile-1').toArray();
    const profile2Categories = await db.categories.where('profileId').equals('profile-2').toArray();
    expect(profile1Categories).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(profile2Categories).toHaveLength(DEFAULT_CATEGORIES.length);
  });
});
