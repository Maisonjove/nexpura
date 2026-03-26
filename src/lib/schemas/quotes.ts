import { z } from "zod";

/**
 * Quote-related Zod schemas for input validation
 */

// Quote sign
export const quoteSignSchema = z.object({
  quoteId: z.string().uuid("Invalid quote ID"),
  signatureData: z.string()
    .min(1, "Signature data is required")
    .max(500000, "Signature data too large"), // Base64 signatures can be large
});

export type QuoteSignInput = z.infer<typeof quoteSignSchema>;
