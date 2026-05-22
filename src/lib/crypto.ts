// Cryptographic utilities for encrypted export/import
// Uses Web Crypto API with AES-GCM and PBKDF2

import type { EncryptedExportEnvelope } from '@/types';

const PBKDF2_ITERATIONS = 600000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const CURRENT_VERSION = 1;

/**
 * Derives an AES-GCM key from a passphrase using PBKDF2
 */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passphraseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passphraseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Converts a Uint8Array to a base64 string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Converts a base64 string to a Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    // eslint-disable-next-line security/detect-object-injection
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypts data with a user-provided passphrase
 * Returns an encrypted envelope with version, salt, IV, and ciphertext
 */
export async function encryptData(
  data: string,
  passphrase: string
): Promise<EncryptedExportEnvelope> {
  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Derive key from passphrase
  const key = await deriveKey(passphrase, salt);

  // Encrypt the data
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(data);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encodedData
  );

  return {
    version: CURRENT_VERSION,
    salt: uint8ArrayToBase64(salt),
    iv: uint8ArrayToBase64(iv),
    ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertext)),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Decrypts an encrypted envelope with the provided passphrase
 * Throws an error if decryption fails (wrong passphrase or tampered data)
 */
export async function decryptData(
  envelope: EncryptedExportEnvelope,
  passphrase: string
): Promise<string> {
  // Validate envelope version
  if (envelope.version !== CURRENT_VERSION) {
    throw new Error('Unsupported envelope version: ' + String(envelope.version));
  }

  // Decode base64 values
  const salt = base64ToUint8Array(envelope.salt);
  const iv = base64ToUint8Array(envelope.iv);
  const ciphertext = base64ToUint8Array(envelope.ciphertext);

  // Derive key from passphrase
  const key = await deriveKey(passphrase, salt);

  try {
    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv.buffer as ArrayBuffer,
      },
      key,
      ciphertext.buffer as ArrayBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch {
    throw new Error('Decryption failed. Wrong passphrase or corrupted data.');
  }
}

/**
 * Validates that an object has the expected encrypted envelope structure
 */
export function isValidEncryptedEnvelope(obj: unknown): obj is EncryptedExportEnvelope {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const envelope = obj as Record<string, unknown>;

  return (
    typeof envelope['version'] === 'number' &&
    typeof envelope['salt'] === 'string' &&
    typeof envelope['iv'] === 'string' &&
    typeof envelope['ciphertext'] === 'string' &&
    typeof envelope['createdAt'] === 'string'
  );
}
