import { z } from "zod";

/**
 * Job-related Zod schemas for input validation
 */

// Job attachment
// PR-01 / W7-CRIT-05: `tenantId` was previously a required field. It is no
// longer read — the route resolves tenant from the caller's session — but
// we keep it as an optional/ignored field so existing clients (and the
// internal fetch calls that still include it) do not fail schema parse
// during the roll-out.
export const jobAttachmentSchema = z.object({
  tenantId: z.string().uuid("Invalid tenant ID").optional(),
  jobType: z.enum(["repair", "bespoke", "sale", "quote", "invoice"], "Invalid job type"),
  jobId: z.string().uuid("Invalid job ID"),
  fileName: z.string().min(1, "File name is required").max(255, "File name too long"),
  fileUrl: z.string().url("Invalid file URL").max(2000, "File URL too long"),
  caption: z.string().max(500, "Caption too long").optional().nullable(),
});

// Job attachment delete
export const jobAttachmentDeleteSchema = z.object({
  attachmentId: z.string().uuid("Invalid attachment ID"),
  tenantId: z.string().uuid("Invalid tenant ID").optional(),
  fileUrl: z.string().url("Invalid file URL").max(2000, "File URL too long").optional(),
});

// Job event
export const jobEventSchema = z.object({
  tenantId: z.string().uuid("Invalid tenant ID").optional(),
  jobType: z.enum(["repair", "bespoke", "sale", "quote", "invoice"], "Invalid job type"),
  jobId: z.string().uuid("Invalid job ID"),
  eventType: z.string().min(1, "Event type is required").max(50, "Event type too long"),
  description: z.string().max(2000, "Description too long").optional(),
  actor: z.string().max(255, "Actor name too long").optional(),
});

export type JobAttachmentInput = z.infer<typeof jobAttachmentSchema>;
export type JobAttachmentDeleteInput = z.infer<typeof jobAttachmentDeleteSchema>;
export type JobEventInput = z.infer<typeof jobEventSchema>;

// ── Repair + bespoke create schemas ─────────────────────────────────────
// Audit finding (Medium): buildRepairData / buildJobData used bare
// `as string | null` casts with no format/range checks. Overlong
// descriptions, malformed dates, and negative prices could land in the DB.

const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), schema.optional());

const priceField = emptyToNull(
  z.coerce.number().min(0, "must be ≥ 0").max(10_000_000, "price too large"),
);
const weightField = emptyToNull(z.coerce.number().min(0).max(100_000));
const isoDateField = emptyToNull(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"));

export const repairCreateSchema = z.object({
  customer_id: emptyToNull(z.string().uuid("customer_id must be a UUID")),
  item_type: z.string().min(1, "item_type is required").max(100),
  item_description: z.string().min(1, "item_description is required").max(5000),
  metal_type: emptyToNull(z.string().max(100)),
  brand: emptyToNull(z.string().max(100)),
  condition_notes: emptyToNull(z.string().max(5000)),
  repair_type: z.string().min(1, "repair_type is required").max(100),
  work_description: emptyToNull(z.string().max(5000)),
  due_date: isoDateField,
  priority: emptyToNull(z.enum(["low", "normal", "high", "urgent"])),
  quoted_price: priceField,
  deposit_amount: priceField,
  customer_email: emptyToNull(z.string().email("invalid customer_email").max(254)),
  estimated_completion_date: isoDateField,
  internal_notes: emptyToNull(z.string().max(5000)),
  client_notes: emptyToNull(z.string().max(5000)),
});
export type RepairCreateInput = z.infer<typeof repairCreateSchema>;

export const bespokeCreateSchema = z.object({
  customer_id: emptyToNull(z.string().uuid("customer_id must be a UUID")),
  title: z.string().min(1, "title is required").max(200, "title too long"),
  jewellery_type: emptyToNull(z.string().max(100)),
  order_type: emptyToNull(z.string().max(50)),
  metal_type: emptyToNull(z.string().max(100)),
  metal_colour: emptyToNull(z.string().max(50)),
  metal_purity: emptyToNull(z.string().max(50)),
  metal_weight_grams: weightField,
  due_date: isoDateField,
  deposit_due_date: isoDateField,
  priority: emptyToNull(z.enum(["low", "normal", "high", "urgent"])),
  quoted_price: priceField,
  deposit_amount: priceField,
  final_price: priceField,
  customer_email: emptyToNull(z.string().email("invalid customer_email").max(254)),
  estimated_completion_date: isoDateField,
  description: emptyToNull(z.string().max(5000)),
  internal_notes: emptyToNull(z.string().max(5000)),
  client_notes: emptyToNull(z.string().max(5000)),
});
export type BespokeCreateInput = z.infer<typeof bespokeCreateSchema>;
