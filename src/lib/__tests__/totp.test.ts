import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateTOTPSecret,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
} from '../totp';

// Mock crypto.subtle for Node.js environment
beforeEach(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        subtle: {
          digest: vi.fn(async (_algorithm: string, data: ArrayBuffer) => {
            const view = new Uint8Array(data);
            const hash = new Uint8Array(32);
            for (let i = 0; i < view.length; i++) {
              hash[i % 32] = (hash[i % 32] + view[i]) % 256;
            }
            return hash.buffer;
          }),
        },
        getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
          if (array) {
            const typedArray = array as unknown as Uint8Array;
            for (let i = 0; i < typedArray.length; i++) {
              typedArray[i] = Math.floor(Math.random() * 256);
            }
          }
          return array;
        },
      },
      configurable: true,
    });
  }
});

describe('generateTOTPSecret', () => {
  it('generates a secret string', () => {
    const secret = generateTOTPSecret();
    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThan(0);
  });

  it('generates unique secrets', () => {
    const secret1 = generateTOTPSecret();
    const secret2 = generateTOTPSecret();
    expect(secret1).not.toBe(secret2);
  });
});

describe('generateBackupCodes', () => {
  it('generates default 8 codes', () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(8);
  });

  it('generates specified number of codes', () => {
    const codes = generateBackupCodes(5);
    expect(codes).toHaveLength(5);
  });

  it('generates 8-character codes', () => {
    const codes = generateBackupCodes();
    codes.forEach((code) => {
      expect(code).toHaveLength(8);
    });
  });

  it('generates codes with valid characters only', () => {
    const validChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const codes = generateBackupCodes(10);
    codes.forEach((code) => {
      for (const char of code) {
        expect(validChars).toContain(char);
      }
    });
  });

  it('generates unique codes', () => {
    const codes = generateBackupCodes(100);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(100);
  });
});

describe('hashBackupCode', () => {
  it('returns a hex string', async () => {
    const hash = await hashBackupCode('TESTCODE');
    expect(typeof hash).toBe('string');
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('returns consistent hash for same input', async () => {
    const hash1 = await hashBackupCode('ABCD1234');
    const hash2 = await hashBackupCode('ABCD1234');
    expect(hash1).toBe(hash2);
  });

  it('is case insensitive', async () => {
    const hashUpper = await hashBackupCode('TESTCODE');
    const hashLower = await hashBackupCode('testcode');
    expect(hashUpper).toBe(hashLower);
  });

  it('produces different hashes for different inputs', async () => {
    const hash1 = await hashBackupCode('CODE1111');
    const hash2 = await hashBackupCode('CODE2222');
    expect(hash1).not.toBe(hash2);
  });
});

describe('verifyBackupCode', () => {
  it('returns valid true for matching code', async () => {
    const code = 'TESTCODE';
    const hashedCode = await hashBackupCode(code);
    const result = await verifyBackupCode(code, [hashedCode]);
    expect(result.valid).toBe(true);
    expect(result.usedIndex).toBe(0);
  });

  it('returns valid false for non-matching code', async () => {
    const hashedCode = await hashBackupCode('REALCODE');
    const result = await verifyBackupCode('FAKECODE', [hashedCode]);
    expect(result.valid).toBe(false);
    expect(result.usedIndex).toBe(-1);
  });

  it('returns correct index when code is found', async () => {
    const codes = ['CODE1111', 'CODE2222', 'CODE3333'];
    const hashedCodes = await Promise.all(codes.map(hashBackupCode));
    
    const result = await verifyBackupCode('CODE2222', hashedCodes);
    expect(result.valid).toBe(true);
    expect(result.usedIndex).toBe(1);
  });

  it('works with empty array', async () => {
    const result = await verifyBackupCode('ANYCODE1', []);
    expect(result.valid).toBe(false);
    expect(result.usedIndex).toBe(-1);
  });

  it('is case insensitive for verification', async () => {
    const hashedCode = await hashBackupCode('TESTCODE');
    const result = await verifyBackupCode('testcode', [hashedCode]);
    expect(result.valid).toBe(true);
  });
});
