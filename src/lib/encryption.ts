/**
 * Field-level encryption for sensitive PII data
 * 
 * Uses AES-256-GCM for authenticated encryption.
 * Key is derived from ENCRYPTION_KEY env var using PBKDF2.
 * 
 * Encrypted values are stored as: enc_v1:<iv>:<authTag>:<ciphertext>
 * This allows detection of encrypted vs plaintext values.
 */

import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT = 'nexpura-pii-encryption-salt-v1'; // Static salt is fine since key is already high-entropy
const PREFIX = 'enc_v1:';

let derivedKey: Buffer | null = null;

function getKey(): Buffer {
  if (derivedKey) return derivedKey;
  
  const masterKey = process.env.ENCRYPTION_KEY;
  if (!masterKey) {
    // In development without key, return a deterministic test key
    // This allows the app to run but data won't be encrypted
    if (process.env.NODE_ENV === 'development') {
      console.warn('[encryption] ENCRYPTION_KEY not set, using insecure dev key');
      derivedKey = Buffer.alloc(KEY_LENGTH, 0);
      return derivedKey;
    }
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  
  derivedKey = pbkdf2Sync(masterKey, SALT, 100000, KEY_LENGTH, 'sha256');
  return derivedKey;
}

/**
 * Encrypt a string value
 * Returns the encrypted value with prefix, or original if empty/null
 */
export function encrypt(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;
  if (plaintext.startsWith(PREFIX)) return plaintext; // Already encrypted
  
  try {
    const key = getKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    return `${PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  } catch (error) {
    console.error('[encryption] Encrypt failed:', error);
    return plaintext; // Return plaintext on failure (graceful degradation)
  }
}

/**
 * Decrypt an encrypted value
 * Returns the original plaintext, or the value as-is if not encrypted
 */
export function decrypt(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;
  if (!ciphertext.startsWith(PREFIX)) return ciphertext; // Not encrypted, return as-is
  
  try {
    const key = getKey();
    const parts = ciphertext.slice(PREFIX.length).split(':');
    
    if (parts.length !== 3) {
      console.error('[encryption] Invalid encrypted format');
      return ciphertext;
    }
    
    const [ivBase64, authTagBase64, encryptedBase64] = parts;
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const encrypted = Buffer.from(encryptedBase64, 'base64');
    
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('[encryption] Decrypt failed:', error);
    return null; // Return null on decryption failure (data integrity issue)
  }
}

/**
 * Check if a value is encrypted
 */
export function isEncrypted(value: string | null | undefined): boolean {
  return value?.startsWith(PREFIX) ?? false;
}

/**
 * Encrypt sensitive fields in an object
 * Only encrypts specified fields, leaves others untouched
 */
export function encryptFields<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const result = { ...obj };
  for (const field of fields) {
    const value = obj[field];
    if (typeof value === 'string') {
      result[field] = encrypt(value) as T[keyof T];
    }
  }
  return result;
}

/**
 * Decrypt sensitive fields in an object
 * Only decrypts specified fields, leaves others untouched
 */
export function decryptFields<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const result = { ...obj };
  for (const field of fields) {
    const value = obj[field];
    if (typeof value === 'string') {
      result[field] = decrypt(value) as T[keyof T];
    }
  }
  return result;
}

/**
 * Sensitive fields that should be encrypted in the customers table
 */
export const CUSTOMER_SENSITIVE_FIELDS = ['email', 'phone', 'address'] as const;

/**
 * Hash a value for searching (deterministic, not reversible)
 * Used for creating searchable indexes on encrypted fields
 */
export function hashForSearch(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  const key = getKey();
  // Use HMAC for deterministic hashing
  const hmac = require('crypto').createHmac('sha256', key);
  hmac.update(normalized);
  return 'hash_v1:' + hmac.digest('base64');
}
