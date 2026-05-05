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
export type InviteAcceptInput = z.infer<typeof inviteAcceptSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
