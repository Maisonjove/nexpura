import { z } from "zod";

/**
 * Tenant-related Zod schemas for input validation
 */

// Subdomain check query params
export const checkSubdomainQuerySchema = z.object({
  subdomain: z.string()
    .min(3, "Subdomain must be at least 3 characters")
    .max(63, "Subdomain must be at most 63 characters")
    .regex(
      /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i,
      "Subdomain must be alphanumeric with hyphens (no leading/trailing hyphens)"
    ),
});

export type CheckSubdomainQuery = z.infer<typeof checkSubdomainQuerySchema>;
