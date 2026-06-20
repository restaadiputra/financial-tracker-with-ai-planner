import type { FinanceTrackerDB } from '@/lib/db/db';
import type { Profile } from '@/lib/db/schema';
import { deriveKeyFromPassword, generateSalt } from '@/lib/crypto/deriveKey';
import { decryptString, encryptString } from '@/lib/crypto/encrypt';

const VERIFIER_PLAINTEXT = 'VAULT_OK';

async function hashEmail(email: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.toLowerCase()));
  return Buffer.from(digest).toString('base64');
}

export interface CreateProfileInput {
  displayName: string;
  email: string;
  password: string;
}

export async function createProfile(db: FinanceTrackerDB, input: CreateProfileInput): Promise<Profile> {
  const salt = generateSalt();
  const key = await deriveKeyFromPassword(input.password, salt);
  const { ciphertext: verifier, iv: verifierIv } = await encryptString(key, VERIFIER_PLAINTEXT);

  const profile: Profile = {
    id: crypto.randomUUID(),
    emailHash: await hashEmail(input.email),
    displayName: input.displayName,
    salt,
    verifier,
    verifierIv,
    createdAt: Date.now(),
  };

  await db.profiles.add(profile);
  return profile;
}

export async function unlockProfile(
  db: FinanceTrackerDB,
  profileId: string,
  password: string
): Promise<CryptoKey | null> {
  const profile = await db.profiles.get(profileId);
  if (!profile) return null;

  const key = await deriveKeyFromPassword(password, profile.salt);

  try {
    const decrypted = await decryptString(key, profile.verifier, profile.verifierIv);
    return decrypted === VERIFIER_PLAINTEXT ? key : null;
  } catch {
    return null;
  }
}
