import { z } from "zod";

/**
 * Auth-related Zod schemas for input validation
 */

// 2FA validate (login)
export const twoFAValidateSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  code: z.string().min(1, "Code is required").max(20, "Code too long"),
});

// 2FA verify (setup confirmation)
export const twoFAVerifySchema = z.object({
  code: z.string().length(6, "Code must be 6 digits").regex(/^\d{6}$/, "Code must be numeric"),
  secret: z.string().min(16, "Invalid secret").max(64, "Invalid secret"),
});

// SMS 2FA setup
export const sms2FASetupSchema = z.object({
  phone: z.string()
    .min(8, "Phone number too short")
    .max(20, "Phone number too long")
    .regex(/^[\d\s+()-]+$/, "Invalid phone number format"),
});

// SMS 2FA verify (setup confirmation)
export const sms2FAVerifySchema = z.object({
  code: z.string().length(6, "Code must be 6 digits").regex(/^\d{6}$/, "Code must be numeric"),
});

// SMS 2FA send login code
export const sms2FASendLoginSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
});

// SMS 2FA verify login
export const sms2FAVerifyLoginSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  code: z.string().min(1, "Code is required").max(20, "Code too long"),
  isBackupCode: z.boolean().optional(),
});

// Invite accept
export const inviteAcceptSchema = z.object({
  token: z.string().min(10, "Invalid token").max(200, "Invalid token"),
  userId: z.string().uuid("Invalid user ID"),
});

// Forgot-password request
export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email").max(254, "Email too long"),
});

export type TwoFAValidateInput = z.infer<typeof twoFAValidateSchema>;
export type TwoFAVerifyInput = z.infer<typeof twoFAVerifySchema>;
export type SMS2FASetupInput = z.infer<typeof sms2FASetupSchema>;
export type SMS2FAVerifyInput = z.infer<typeof sms2FAVerifySchema>;
export type SMS2FASendLoginInput = z.infer<typeof sms2FASendLoginSchema>;
export type SMS2FAVerifyLoginInput = z.infer<typeof sms2FAVerifyLoginSchema>;
export type InviteAcceptInput = z.infer<typeof inviteAcceptSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
