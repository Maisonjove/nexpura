import { z } from "zod";

/**
 * Job-related Zod schemas for input validation
 */

// Job attachment
export const jobAttachmentSchema = z.object({
  tenantId: z.string().uuid("Invalid tenant ID"),
  jobType: z.enum(["repair", "bespoke", "sale", "quote", "invoice"], "Invalid job type"),
  jobId: z.string().uuid("Invalid job ID"),
  fileName: z.string().min(1, "File name is required").max(255, "File name too long"),
  fileUrl: z.string().url("Invalid file URL").max(2000, "File URL too long"),
  caption: z.string().max(500, "Caption too long").optional().nullable(),
});

// Job attachment delete
export const jobAttachmentDeleteSchema = z.object({
  attachmentId: z.string().uuid("Invalid attachment ID"),
  tenantId: z.string().uuid("Invalid tenant ID"),
  fileUrl: z.string().url("Invalid file URL").max(2000, "File URL too long").optional(),
});

// Job event
export const jobEventSchema = z.object({
  tenantId: z.string().uuid("Invalid tenant ID"),
  jobType: z.enum(["repair", "bespoke", "sale", "quote", "invoice"], "Invalid job type"),
  jobId: z.string().uuid("Invalid job ID"),
  eventType: z.string().min(1, "Event type is required").max(50, "Event type too long"),
  description: z.string().max(2000, "Description too long").optional(),
  actor: z.string().max(255, "Actor name too long").optional(),
});

export type JobAttachmentInput = z.infer<typeof jobAttachmentSchema>;
export type JobAttachmentDeleteInput = z.infer<typeof jobAttachmentDeleteSchema>;
export type JobEventInput = z.infer<typeof jobEventSchema>;
