import { describe, expect, test } from 'vitest';
import { FinanceTrackerDB } from '@/lib/db/db';
import { createProfile, unlockProfile } from './vault';

function freshDb() {
  return new FinanceTrackerDB(`test-db-${crypto.randomUUID()}`);
}

describe('createProfile', () => {
  test('stores a profile with hashed email, salt, and verifier, never the raw password', async () => {
    const db = freshDb();
    const profile = await createProfile(db, {
      displayName: 'Resta',
      email: 'Resta@Example.com',
      password: 'correct-horse',
    });

    expect(profile.displayName).toBe('Resta');
    expect(profile.salt).toBeTruthy();
    expect(profile.verifier).toBeTruthy();
    expect(JSON.stringify(profile)).not.toContain('correct-horse');

    const stored = await db.profiles.get(profile.id);
    expect(stored).toBeDefined();
  });

  test('hashes the email case-insensitively', async () => {
    const db = freshDb();
    const profile = await createProfile(db, {
      displayName: 'Resta',
      email: 'Resta@Example.com',
      password: 'correct-horse',
    });

    expect(profile.emailHash).not.toContain('@');
    expect(profile.emailHash).not.toContain('Resta');
  });
});

describe('unlockProfile', () => {
  test('returns a usable key when the password is correct', async () => {
    const db = freshDb();
    const profile = await createProfile(db, {
      displayName: 'Resta',
      email: 'resta@example.com',
      password: 'correct-horse',
    });

    const key = await unlockProfile(db, profile.id, 'correct-horse');
    expect(key).not.toBeNull();
    expect(key?.algorithm.name).toBe('AES-GCM');
  });

  test('returns null when the password is wrong', async () => {
    const db = freshDb();
    const profile = await createProfile(db, {
      displayName: 'Resta',
      email: 'resta@example.com',
      password: 'correct-horse',
    });

    const key = await unlockProfile(db, profile.id, 'wrong-password');
    expect(key).toBeNull();
  });

  test('returns null for a profile id that does not exist', async () => {
    const db = freshDb();
    const key = await unlockProfile(db, 'no-such-id', 'whatever');
    expect(key).toBeNull();
  });
});
