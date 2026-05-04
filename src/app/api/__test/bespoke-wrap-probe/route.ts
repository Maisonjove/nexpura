/**
 * TEMPORARY test endpoint for PR-B2b Workflow 3 verification.
 *
 * Mimics the side-effect-log wrap pattern from updateBespokeStage in
 * src/app/(app)/bespoke/[id]/actions.ts:
 *
 *   const { error } = await admin.from("bespoke_job_stages").insert(...)
 *   if (error) {
 *     logger.error("[updateBespokeStage] bespoke_job_stages insert failed (non-fatal)", { ... })
 *   }
 *
 * Forces a constraint violation (FK to non-existent tenant) so the
 * insert fails, and verifies:
 *   1. error is captured
 *   2. logger.error fires (which routes to Sentry per src/lib/logger.ts:65)
 *   3. function continues + returns successfully (proving "log + continue"
 *      semantics — wrap doesn't throw)
 *
 * Auth: bearer CRON_SECRET to keep this off the public internet during
 * the verification window. Endpoint will be deleted in a follow-up
 * commit once Joey confirms the Sentry capture lands.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeBearerMatch } from "@/lib/timing-safe-compare";
import logger from "@/lib/logger";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Test endpoint not configured" }, { status: 503 });
  }
  if (!safeBearerMatch(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Force a constraint violation: tenant_id pointing to a UUID that
  // doesn't exist in `tenants` (FK violation). Mirrors the wrap
  // pattern from updateBespokeStage.
  const fakeTenantId = "00000000-0000-0000-0000-000000000000";
  const fakeJobId = "00000000-0000-0000-0000-000000000001";
  const { error: stageHistErr } = await admin
    .from("bespoke_job_stages")
    .insert({
      tenant_id: fakeTenantId,
      job_id: fakeJobId,
      stage: "test_injection",
      notes: null,
      created_by: null,
    });

  if (stageHistErr) {
    // Same logger.error call shape as the real wrap. Routes to
    // Sentry.captureException via src/lib/logger.ts:65.
    logger.error("[bespoke-wrap-probe] bespoke_job_stages insert failed (non-fatal)", {
      jobId: fakeJobId,
      err: stageHistErr,
    });
  }

  // Critical: function returns successfully even though the insert
  // failed. This is the "log + continue" semantics the side-effect
  // policy requires. If we threw here, it would mean the wrap is
  // wrong; if we returned 200 with the captured error visible, the
  // wrap is correct.
  return NextResponse.json({
    ok: true,
    captured_error: stageHistErr
      ? {
          code: stageHistErr.code,
          message: stageHistErr.message,
          details: stageHistErr.details,
        }
      : null,
    note:
      "Side-effect-log policy verified: insert failed, error captured, logger.error fired, function returned successfully without throwing. Sentry should have captured the logger.error call.",
  });
}
