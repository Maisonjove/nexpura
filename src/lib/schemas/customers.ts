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

/**
 * Customer create/update — validates FormData payload before it hits the
 * DB. Audit finding (Medium): buildCustomerData was using bare
 * `formData.get(x) as string` casts with no format/length validation.
 * Emails like "not-an-email" were stored as-is, stacking up to 10k-char
 * tag strings was technically possible, etc. Zod catches the garbage
 * before the insert.
 *
 * Fields are all optional except first_name or last_name (need at least
 * one for full_name to be derived). Explicitly-empty strings are coerced
 * to undefined so the DB gets NULL instead of "".
 */
const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), schema.optional());

export const customerCreateSchema = z.object({
  first_name: emptyToNull(z.string().max(100, "first_name too long")),
  last_name: emptyToNull(z.string().max(100, "last_name too long")),
  email: emptyToNull(z.string().email("invalid email").max(254)),
  mobile: emptyToNull(z.string().max(32, "mobile too long").regex(/^[+0-9\s\-()]{6,32}$/, "invalid mobile format")),
  phone: emptyToNull(z.string().max(32, "phone too long").regex(/^[+0-9\s\-()]{6,32}$/, "invalid phone format")),
  address_line1: emptyToNull(z.string().max(200)),
  suburb: emptyToNull(z.string().max(100)),
  state: emptyToNull(z.string().max(64)),
  postcode: emptyToNull(z.string().max(20)),
  country: emptyToNull(z.string().max(100)),
  ring_size: emptyToNull(z.string().max(20)),
  preferred_metal: emptyToNull(z.string().max(64)),
  birthday: emptyToNull(z.string().max(20)),
  anniversary: emptyToNull(z.string().max(20)),
  notes: emptyToNull(z.string().max(5000, "notes too long")),
  tags: z.array(z.string().max(50)).max(20).optional(),
}).refine(
  (data) => (data.first_name && data.first_name.length > 0) || (data.last_name && data.last_name.length > 0),
  { message: "Provide a first name or last name", path: ["first_name"] },
);

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
