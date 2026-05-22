import { describe, it, expect } from 'vitest';
import {
  encryptData,
  decryptData,
  isValidEncryptedEnvelope,
} from '@/lib/crypto';

describe('crypto', () => {
  describe('encryptData and decryptData', () => {
    it('should encrypt and decrypt data successfully', async () => {
      const originalData = JSON.stringify({ test: 'data', number: 123 });
      const passphrase = 'test-passphrase-123';

      const encrypted = await encryptData(originalData, passphrase);
      const decrypted = await decryptData(encrypted, passphrase);

      expect(decrypted).toBe(originalData);
    });

    it('should produce different ciphertext for same data', async () => {
      const data = 'test data';
      const passphrase = 'passphrase';

      const encrypted1 = await encryptData(data, passphrase);
      const encrypted2 = await encryptData(data, passphrase);

      // Different salt and IV should produce different ciphertext
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should fail decryption with wrong passphrase', async () => {
      const data = 'test data';
      const encrypted = await encryptData(data, 'correct-passphrase');

      await expect(decryptData(encrypted, 'wrong-passphrase')).rejects.toThrow(
        'Decryption failed'
      );
    });

    it('should fail with tampered ciphertext', async () => {
      const data = 'test data';
      const encrypted = await encryptData(data, 'passphrase');

      // Tamper with ciphertext by flipping all bits (XOR with 0xFF on first byte)
      const ciphertextBytes = atob(encrypted.ciphertext);
      const tamperedBytes = String.fromCharCode(ciphertextBytes.charCodeAt(0) ^ 0xFF) + ciphertextBytes.slice(1);
      const tamperedCiphertext = btoa(tamperedBytes);

      const tamperedEnvelope = {
        ...encrypted,
        ciphertext: tamperedCiphertext,
      };

      await expect(decryptData(tamperedEnvelope, 'passphrase')).rejects.toThrow();
    });

    it('should handle unicode and special characters', async () => {
      const data = 'Test with émojis 🎉 and ñ special chars 日本語';
      const passphrase = 'pässwörd-🔐';

      const encrypted = await encryptData(data, passphrase);
      const decrypted = await decryptData(encrypted, passphrase);

      expect(decrypted).toBe(data);
    });

    it('should handle large data', async () => {
      const largeData = 'x'.repeat(100000);
      const passphrase = 'passphrase';

      const encrypted = await encryptData(largeData, passphrase);
      const decrypted = await decryptData(encrypted, passphrase);

      expect(decrypted).toBe(largeData);
    });

    it('should include version and timestamp in envelope', async () => {
      const encrypted = await encryptData('data', 'pass');

      expect(encrypted.version).toBe(1);
      expect(encrypted.createdAt).toBeDefined();
      expect(new Date(encrypted.createdAt).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('isValidEncryptedEnvelope', () => {
    it('should return true for valid envelope', async () => {
      const encrypted = await encryptData('data', 'pass');
      expect(isValidEncryptedEnvelope(encrypted)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isValidEncryptedEnvelope(null)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isValidEncryptedEnvelope('string')).toBe(false);
      expect(isValidEncryptedEnvelope(123)).toBe(false);
    });

    it('should return false for missing fields', () => {
      expect(isValidEncryptedEnvelope({})).toBe(false);
      expect(isValidEncryptedEnvelope({ version: 1 })).toBe(false);
      expect(isValidEncryptedEnvelope({ version: 1, salt: 'x' })).toBe(false);
    });

    it('should return false for wrong field types', () => {
      expect(
        isValidEncryptedEnvelope({
          version: '1',
          salt: 'x',
          iv: 'y',
          ciphertext: 'z',
          createdAt: 'date',
        })
      ).toBe(false);
    });
  });
});
