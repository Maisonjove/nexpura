"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { updateSegmentCount } from "@/lib/marketing/segments";
import { logger } from "@/lib/logger";
import { requireAuth, requireRole } from "@/lib/auth-context";

import { flushSentry } from "@/lib/sentry-flush";
interface SegmentData {
  name: string;
  description?: string;
  rules: Record<string, unknown>;
}

const SEGMENT_RULE_TYPES = ["new", "lapsed", "high_value", "vip", "repair"] as const;

/**
 * Validate the rules payload before persistence.
 *
 * Audit ID M-07 (desktop-Opus): "Segments builder allows empty
 * segments to save — Required: at least one rule." Pre-fix the
 * server accepted any `rules` object, including `{}` or
 * `{ type: "custom" }` (the UI's dropdown silently produced this
 * if the user opened the modal and submitted without changing the
 * type — the initial state was `rule_type: "custom"` but the
 * dropdown didn't include a "custom" option, so the visible select
 * showed "new" while the state stayed "custom"). Either shape
 * persisted a segment that matches no customers, breaking
 * marketing-send list intent.
 *
 * Post-fix: rules MUST include `type` ∈ SEGMENT_RULE_TYPES, AND
 * the type-specific qualifier when the type requires one (the
 * `repair` type has no qualifier — it's a self-describing flag).
 */
function validateSegmentRules(rules: Record<string, unknown>): string | null {
  if (!rules || typeof rules !== "object") {
    return "At least one rule is required for a segment.";
  }
  const type = rules.type;
  if (
    typeof type !== "string" ||
    !(SEGMENT_RULE_TYPES as readonly string[]).includes(type)
  ) {
    return "Choose a valid segment type.";
  }
  if (type === "new" && (typeof rules.days !== "number" || rules.days <= 0)) {
    return "New customers segment needs a positive 'days' value.";
  }
  if (type === "lapsed" && (typeof rules.months !== "number" || rules.months <= 0)) {
    return "Lapsed customers segment needs a positive 'months' value.";
  }
  if (type === "high_value" && (typeof rules.amount !== "number" || rules.amount <= 0)) {
    return "High value segment needs a positive minimum-purchase amount.";
  }
  if (
    type === "vip" &&
    (typeof rules.percentile !== "number" || rules.percentile <= 0 || rules.percentile > 100)
  ) {
    return "VIP segment needs a percentile between 1 and 100.";
  }
  // type === "repair" is a flag with no qualifier — accepted.
  return null;
}

export async function createSegment(data: SegmentData) {
  try {
    // W5-CRIT-004: segments define who marketing sends to — owner/manager only.
    await requireRole("owner", "manager");

    // M-07 server-side validation. The UI surfaces these messages
    // in its inline error state, but a malicious form submission
    // can't bypass the gate by skipping the client check.
    if (!data.name || data.name.trim().length === 0) {
      return { error: "Segment name is required." };
    }
    const ruleErr = validateSegmentRules(data.rules);
    if (ruleErr) return { error: ruleErr };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const admin = createAdminClient();
    const { data: userData } = await admin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return { error: "Tenant not found" };

    const { data: segment, error } = await admin
      .from("customer_segments")
      .insert({
        tenant_id: userData.tenant_id,
        name: data.name,
        description: data.description || null,
        rules: data.rules,
        is_system: false,
      })
      .select()
      .single();

    if (error) return { error: error.message };

    // Update customer count
    await updateSegmentCount(userData.tenant_id, segment.id);

    revalidatePath("/marketing/segments");
    return { success: true, segment };
  } catch (error) {
    logger.error("createSegment failed", { error });
    await flushSentry();
    return { error: "Operation failed" };
  }
}

export async function updateSegment(id: string, data: Partial<SegmentData>) {
  try {
    // W5-CRIT-004: owner/manager only.
    await requireRole("owner", "manager");

    // M-07: same validation on update — a partial update that
    // narrows rules to an empty/invalid shape would re-introduce
    // the empty-segment-saved bug.
    if (data.name !== undefined && data.name.trim().length === 0) {
      return { error: "Segment name is required." };
    }
    if (data.rules !== undefined) {
      const ruleErr = validateSegmentRules(data.rules);
      if (ruleErr) return { error: ruleErr };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const admin = createAdminClient();
    const { data: userData } = await admin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return { error: "Tenant not found" };

    // Check segment belongs to tenant and is not system
    const { data: existing } = await admin
      .from("customer_segments")
      .select("is_system")
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (!existing) return { error: "Segment not found" };
    if (existing.is_system) return { error: "Cannot edit system segments" };

    const { error } = await admin
      .from("customer_segments")
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) return { error: error.message };

    // Update customer count if rules changed
    if (data.rules) {
      await updateSegmentCount(userData.tenant_id, id);
    }

    revalidatePath("/marketing/segments");
    return { success: true };
  } catch (error) {
    logger.error("updateSegment failed", { error });
    await flushSentry();
    return { error: "Operation failed" };
  }
}

export async function deleteSegment(id: string) {
  try {
    // RBAC: segments scope marketing sends; destructive removal is
    // owner/manager only to prevent accidental/unauthorized send-list wipes.
    const authCtx = await requireAuth();
    if (!authCtx.isManager && !authCtx.isOwner) {
      return { error: "Only owner or manager can delete customer segments." };
    }
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const admin = createAdminClient();
    const { data: userData } = await admin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return { error: "Tenant not found" };

    // Check segment is not system
    const { data: existing } = await admin
      .from("customer_segments")
      .select("is_system")
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (!existing) return { error: "Segment not found" };
    if (existing.is_system) return { error: "Cannot delete system segments" };

    const { error } = await admin
      .from("customer_segments")
      .delete()
      .eq("id", id);

    if (error) return { error: error.message };

    revalidatePath("/marketing/segments");
    return { success: true };
  } catch (error) {
    logger.error("deleteSegment failed", { error });
    await flushSentry();
    return { error: "Operation failed" };
  }
}

export async function refreshSegmentCount(id: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const admin = createAdminClient();
    const { data: userData } = await admin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return { error: "Tenant not found" };

    const count = await updateSegmentCount(userData.tenant_id, id);

    revalidatePath("/marketing/segments");
    return { success: true, count };
  } catch (error) {
    logger.error("refreshSegmentCount failed", { error });
    await flushSentry();
    return { error: "Operation failed" };
  }
}
