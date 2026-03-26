/**
 * TOTP (Time-based One-Time Password) utilities for 2FA
 */
import { generateSecret as generateOTPSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';

/**
 * Generate a new TOTP secret for a user
 */
export function generateTOTPSecret(): string {
  return generateOTPSecret();
}

/**
 * Generate a QR code data URL for the TOTP secret
 */
export async function generateTOTPQRCode(
  secret: string,
  email: string,
  issuer: string = 'Nexpura'
): Promise<string> {
  const otpauth = generateURI({
    secret,
    issuer,
    label: `${issuer}:${email}`,
    algorithm: 'sha1',
    digits: 6,
    period: 30,
  });
  
  return QRCode.toDataURL(otpauth, {
    width: 200,
    margin: 2,
    color: {
      dark: '#1A1A1A',
      light: '#FFFFFF',
    },
  });
}

/**
 * Verify a TOTP token against a secret
 */
export function verifyTOTPToken(token: string, secret: string): boolean {
  try {
    const result = verifySync({
      token,
      secret,
      strategy: 'totp',
      algorithm: 'sha1',
      digits: 6,
      period: 30,
    });
    return result.valid;
  } catch {
    return false;
  }
}

/**
 * Generate backup codes (one-time use recovery codes)
 */
export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generate random 8-character alphanumeric codes
    const code = Array.from({ length: 8 }, () =>
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
    ).join('');
    codes.push(code);
  }
  return codes;
}

/**
 * Hash a backup code for storage
 */
export async function hashBackupCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code.toUpperCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a backup code against stored hashes
 */
export async function verifyBackupCode(
  code: string,
  hashedCodes: string[]
): Promise<{ valid: boolean; usedIndex: number }> {
  const hashedInput = await hashBackupCode(code);
  const index = hashedCodes.indexOf(hashedInput);
  return {
    valid: index !== -1,
    usedIndex: index,
  };
}
