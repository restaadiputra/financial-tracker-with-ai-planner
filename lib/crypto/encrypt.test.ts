import { describe, expect, test } from 'vitest';
import { deriveKeyFromPassword, generateSalt } from './deriveKey';
import { decryptString, encryptString } from './encrypt';

describe('encryptString / decryptString', () => {
  test('round-trips a plaintext string', async () => {
    const key = await deriveKeyFromPassword('correct-horse', generateSalt());
    const { ciphertext, iv } = await encryptString(key, 'hello vault');

    const decrypted = await decryptString(key, ciphertext, iv);
    expect(decrypted).toBe('hello vault');
  });

  test('produces a unique iv on each call, even for the same plaintext', async () => {
    const key = await deriveKeyFromPassword('correct-horse', generateSalt());
    const first = await encryptString(key, 'hello vault');
    const second = await encryptString(key, 'hello vault');

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  test('decrypting with the wrong key throws rather than returning garbage', async () => {
    const salt = generateSalt();
    const keyA = await deriveKeyFromPassword('correct-horse', salt);
    const keyB = await deriveKeyFromPassword('wrong-password', salt);

    const { ciphertext, iv } = await encryptString(keyA, 'hello vault');

    await expect(decryptString(keyB, ciphertext, iv)).rejects.toThrow();
  });
});
