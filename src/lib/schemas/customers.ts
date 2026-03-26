import { z } from "zod";

/**
 * Customer-related Zod schemas for input validation
 */

// Customer merge
export const customerMergeSchema = z.object({
  primaryId: z.string().uuid("Invalid primary customer ID"),
  secondaryIds: z.array(z.string().uuid("Invalid customer ID"))
    .min(1, "At least one secondary customer ID is required")
    .max(50, "Too many customers to merge at once"),
});

export type CustomerMergeInput = z.infer<typeof customerMergeSchema>;
