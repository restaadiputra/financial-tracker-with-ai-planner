import { describe, expect, test } from 'vitest';
import { deriveKeyFromPassword, generateSalt } from './deriveKey';

describe('generateSalt', () => {
  test('returns a base64 string decoding to 16 bytes', () => {
    const salt = generateSalt();
    const bytes = Buffer.from(salt, 'base64');
    expect(bytes.length).toBe(16);
  });

  test('returns a different salt on each call', () => {
    expect(generateSalt()).not.toBe(generateSalt());
  });
});

describe('deriveKeyFromPassword', () => {
  test('derives an AES-GCM key usable for encrypt/decrypt', async () => {
    const salt = generateSalt();
    const key = await deriveKeyFromPassword('correct-horse', salt);
    expect(key.algorithm.name).toBe('AES-GCM');
    expect(key.usages).toContain('encrypt');
    expect(key.usages).toContain('decrypt');
  });

  test('same password + salt derives a key that decrypts data encrypted by the other', async () => {
    const salt = generateSalt();
    const keyA = await deriveKeyFromPassword('correct-horse', salt);
    const keyB = await deriveKeyFromPassword('correct-horse', salt);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode('VAULT_OK');
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyA, plaintext);

    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, keyB, ciphertext);
    expect(new TextDecoder().decode(decrypted)).toBe('VAULT_OK');
  });

  test('different password with same salt derives a key that fails to decrypt', async () => {
    const salt = generateSalt();
    const keyA = await deriveKeyFromPassword('correct-horse', salt);
    const keyB = await deriveKeyFromPassword('wrong-password', salt);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode('VAULT_OK');
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyA, plaintext);

    await expect(
      crypto.subtle.decrypt({ name: 'AES-GCM', iv }, keyB, ciphertext)
    ).rejects.toThrow();
  });
});
