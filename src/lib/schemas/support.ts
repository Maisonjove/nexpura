import { z } from "zod";

/**
 * Support-related Zod schemas for input validation
 */

// Support chat
export const supportChatSchema = z.object({
  message: z.string()
    .min(1, "Message is required")
    .max(4000, "Message too long"),
});

export type SupportChatInput = z.infer<typeof supportChatSchema>;
