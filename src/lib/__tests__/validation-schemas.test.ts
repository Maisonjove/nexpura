import { describe, it, expect } from "vitest";
import { customerCreateSchema } from "../schemas/customers";
import { repairCreateSchema, bespokeCreateSchema } from "../schemas/jobs";

/**
 * Regression for the Zod schemas that gate create-path mutations.
 * Audit finding (Medium): FormData fields were cast with bare `as string`
 * and landed in the DB unvalidated — malformed emails, negative prices,
 * overlong descriptions, non-date date fields could all pass through.
 */

describe("customerCreateSchema", () => {
  const valid = {
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@example.com",
    mobile: "+61 400 000 000",
    tags: [],
  };

  it("accepts a sensible customer", () => {
    expect(customerCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("requires at least first_name OR last_name", () => {
    const r = customerCreateSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("rejects malformed email", () => {
    const r = customerCreateSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(r.success).toBe(false);
  });

  it("rejects overlong notes", () => {
    const r = customerCreateSchema.safeParse({ ...valid, notes: "x".repeat(6000) });
    expect(r.success).toBe(false);
  });

  it("rejects non-phone-shaped mobile", () => {
    const r = customerCreateSchema.safeParse({ ...valid, mobile: "not-a-number-!!" });
    expect(r.success).toBe(false);
  });

  it("normalises empty-string email to optional/undefined (DB gets NULL)", () => {
    const r = customerCreateSchema.safeParse({ ...valid, email: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBeUndefined();
  });
});

describe("repairCreateSchema", () => {
  const valid = {
    item_type: "ring",
    item_description: "18ct gold band",
    repair_type: "resize",
  };

  it("accepts a sensible repair", () => {
    expect(repairCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("requires item_description", () => {
    const r = repairCreateSchema.safeParse({ ...valid, item_description: "" });
    expect(r.success).toBe(false);
  });

  it("requires repair_type", () => {
    const r = repairCreateSchema.safeParse({ ...valid, repair_type: "" });
    expect(r.success).toBe(false);
  });

  it("rejects negative quoted_price", () => {
    const r = repairCreateSchema.safeParse({ ...valid, quoted_price: "-100" });
    expect(r.success).toBe(false);
  });

  it("rejects malformed customer_email", () => {
    const r = repairCreateSchema.safeParse({ ...valid, customer_email: "xxx" });
    expect(r.success).toBe(false);
  });

  it("rejects non-UUID customer_id", () => {
    const r = repairCreateSchema.safeParse({ ...valid, customer_id: "definitely-not-a-uuid" });
    expect(r.success).toBe(false);
  });

  it("rejects non-date due_date", () => {
    const r = repairCreateSchema.safeParse({ ...valid, due_date: "nextweek" });
    expect(r.success).toBe(false);
  });

  it("accepts empty-string optional fields and coerces to undefined", () => {
    const r = repairCreateSchema.safeParse({
      ...valid,
      customer_email: "",
      due_date: "",
      quoted_price: "",
    });
    expect(r.success).toBe(true);
  });

  it("coerces numeric price strings to numbers", () => {
    const r = repairCreateSchema.safeParse({ ...valid, quoted_price: "250.50" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.quoted_price).toBe(250.5);
  });

  it("rejects overlong description", () => {
    const r = repairCreateSchema.safeParse({
      ...valid,
      item_description: "x".repeat(6000),
    });
    expect(r.success).toBe(false);
  });
});

describe("bespokeCreateSchema", () => {
  const valid = { title: "Custom engagement ring" };

  it("accepts a sensible bespoke job", () => {
    expect(bespokeCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("requires title", () => {
    const r = bespokeCreateSchema.safeParse({ ...valid, title: "" });
    expect(r.success).toBe(false);
  });

  it("rejects overlong title", () => {
    const r = bespokeCreateSchema.safeParse({ ...valid, title: "x".repeat(300) });
    expect(r.success).toBe(false);
  });

  it("rejects negative deposit_amount", () => {
    const r = bespokeCreateSchema.safeParse({ ...valid, deposit_amount: "-1" });
    expect(r.success).toBe(false);
  });

  it("rejects negative metal_weight_grams", () => {
    const r = bespokeCreateSchema.safeParse({ ...valid, metal_weight_grams: "-5" });
    expect(r.success).toBe(false);
  });

  it("rejects priority outside the enum", () => {
    const r = bespokeCreateSchema.safeParse({ ...valid, priority: "eventually" });
    expect(r.success).toBe(false);
  });

  it("rejects malformed date fields", () => {
    const r = bespokeCreateSchema.safeParse({ ...valid, due_date: "soon" });
    expect(r.success).toBe(false);
  });
});
