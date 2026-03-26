import { z } from "zod";

/**
 * Notification-related Zod schemas for input validation
 */

// Phone number regex - supports international format
const phoneRegex = /^[\d\s+()-]+$/;

// WhatsApp send (via Meta Business API)
export const whatsappSendSchema = z.object({
  to: z.string()
    .min(8, "Phone number too short")
    .max(20, "Phone number too long")
    .regex(phoneRegex, "Invalid phone number format"),
  message: z.string()
    .min(1, "Message is required")
    .max(4096, "Message too long"), // WhatsApp limit
});

// WhatsApp notification (via Twilio)
export const whatsappNotifySchema = z.object({
  to: z.string()
    .min(8, "Phone number too short")
    .max(20, "Phone number too long")
    .regex(phoneRegex, "Invalid phone number format"),
  message: z.string()
    .min(1, "Message is required")
    .max(1600, "Message too long"), // Twilio SMS/WhatsApp limit
});

export type WhatsAppSendInput = z.infer<typeof whatsappSendSchema>;
export type WhatsAppNotifyInput = z.infer<typeof whatsappNotifySchema>;
