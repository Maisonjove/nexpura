"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import logger from "@/lib/logger"

// Dedupe window for "same notification fired again" — Stripe webhook
// retries, double-fired triggers, network jitter all push the same
// (tenant, user, type, link) tuple within seconds. Without dedup the
// inbox fills with N copies of "Repair RP-0042 is ready". 5 minutes
// is broad enough to absorb retry storms; narrower lets duplicates
// through under heavier loads, wider swallows genuinely-new identical
// notifications.
const DEDUPE_WINDOW_SECONDS = 5 * 60

export async function createNotification({
  tenantId,
  userId,
  type,
  title,
  body,
  link,
}: {
  tenantId: string
  userId?: string | null
  type: string
  title: string
  body?: string
  link?: string
}) {
  const admin = createAdminClient()

  // Skip insert if an identical notification was created in the last
  // DEDUPE_WINDOW_SECONDS. Match on the tuple that uniquely identifies
  // an event (tenant, user, type, link). Title/body can drift in
  // wording without representing a different event, so we leave them
  // out of the dedup key.
  const sinceIso = new Date(
    Date.now() - DEDUPE_WINDOW_SECONDS * 1000,
  ).toISOString()
  let dedupQuery = admin
    .from("notifications")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("type", type)
    .gte("created_at", sinceIso)
    .limit(1)

  if (userId) dedupQuery = dedupQuery.eq("user_id", userId)
  else dedupQuery = dedupQuery.is("user_id", null)
  if (link) dedupQuery = dedupQuery.eq("link", link)
  else dedupQuery = dedupQuery.is("link", null)

  const { data: existing } = await dedupQuery
  if (existing && existing.length > 0) {
    return // dedup hit — already notified within the window
  }

  // Side-effect log+continue: notifications is the in-app toast/inbox
  // observability channel. A failed insert means the user doesn't see
  // a banner for this event, but the underlying business action that
  // triggered the call already succeeded. Callers (.catch wrappers in
  // messaging.ts, route handlers) treat this as best-effort — preserve
  // that contract by logging and returning normally.
  const { error } = await admin.from("notifications").insert({
    tenant_id: tenantId,
    user_id: userId ?? null,
    type,
    title,
    body: body ?? null,
    link: link ?? null,
  })
  if (error) {
    logger.error("[notifications] insert failed (non-fatal — in-app banner missed)", {
      tenantId, userId, type, link, err: error,
    })
  }
}
