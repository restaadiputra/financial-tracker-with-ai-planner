const PBKDF2_ITERATIONS = 210_000;

/**
 * The Web Crypto API (`crypto.subtle`) is only exposed in secure contexts —
 * HTTPS pages or localhost. Over plain HTTP (e.g. opening the dev server from a
 * phone via a LAN IP like http://192.168.x.x:3000) `crypto.subtle` is undefined,
 * and every vault operation fails with an opaque "reading 'importKey'" TypeError.
 * Fail loudly with a fixable message instead. Dev: `next dev --experimental-https`.
 */
function assertSecureContext(): void {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error(
      'Your vault needs a secure connection (HTTPS) to encrypt your data. ' +
        'Open this app over https:// or on localhost and try again.'
    );
  }
}

export function generateSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Buffer.from(bytes).toString('base64');
}

export async function deriveKeyFromPassword(password: string, saltBase64: string): Promise<CryptoKey> {
  assertSecureContext();
  const salt = Buffer.from(saltBase64, 'base64');
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
