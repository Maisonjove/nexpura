/**
 * Centralized Zod schemas for API input validation
 *
 * Usage:
 * import { posRefundSchema, type PosRefundInput } from "@/lib/schemas";
 *
 * const result = posRefundSchema.safeParse(body);
 * if (!result.success) {
 *   return NextResponse.json({ error: result.error.issues }, { status: 400 });
 * }
 * const data = result.data; // typed!
 */

export * from "./auth";
export * from "./pos";
export * from "./customers";
export * from "./jobs";
export * from "./quotes";
export * from "./notifications";
export * from "./migration";
export * from "./support";
export * from "./tenant";
