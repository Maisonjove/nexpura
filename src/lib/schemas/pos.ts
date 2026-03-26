import { z } from "zod";

/**
 * POS-related Zod schemas for input validation
 */

// Refund item
const refundItemSchema = z.object({
  saleItemId: z.string().uuid("Invalid sale item ID"),
  quantity: z.number().int().positive("Quantity must be positive"),
  unitPrice: z.number().nonnegative("Unit price must be non-negative"),
});

// POS Refund
export const posRefundSchema = z.object({
  tenantId: z.string().uuid("Invalid tenant ID"),
  saleId: z.string().uuid("Invalid sale ID"),
  items: z.array(refundItemSchema).min(1, "At least one item is required"),
  refundMethod: z.enum(["cash", "card", "store_credit", "original_payment"], "Invalid refund method").optional(),
  reason: z.string().max(500, "Reason too long").optional(),
  notes: z.string().max(1000, "Notes too long").optional(),
  total: z.number().nonnegative("Total must be non-negative"),
});

// Find sale (GET params)
export const findSaleQuerySchema = z.object({
  q: z.string().min(1, "Search query is required").max(100, "Query too long"),
  tenantId: z.string().uuid("Invalid tenant ID"),
});

export type PosRefundInput = z.infer<typeof posRefundSchema>;
export type FindSaleQuery = z.infer<typeof findSaleQuerySchema>;
