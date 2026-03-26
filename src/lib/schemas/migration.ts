import { z } from "zod";

/**
 * Migration-related Zod schemas for input validation
 */

// Migration session create
export const migrationCreateSessionSchema = z.object({
  sourcePlatform: z.string().max(100, "Source platform too long").optional(),
});

// Migration execute
export const migrationExecuteSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
});

// Migration update session
export const migrationUpdateSessionSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
  status: z.string().max(50, "Status too long").optional(),
  dataScope: z.enum(["active", "active_and_recent", "full_archive"]).optional(),
  mode: z.enum(["guided", "express", "advanced"]).optional(),
  session_name: z.string().max(200, "Session name too long").optional(),
}).passthrough();

export type MigrationCreateSessionInput = z.infer<typeof migrationCreateSessionSchema>;
export type MigrationExecuteInput = z.infer<typeof migrationExecuteSchema>;
export type MigrationUpdateSessionInput = z.infer<typeof migrationUpdateSessionSchema>;
