"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { updateSegmentCount } from "@/lib/marketing/segments";
import { logger } from "@/lib/logger";

interface SegmentData {
  name: string;
  description?: string;
  rules: Record<string, unknown>;
}

export async function createSegment(data: SegmentData) {
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
    return { error: "Operation failed" };
  }
}

export async function updateSegment(id: string, data: Partial<SegmentData>) {
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
    return { error: "Operation failed" };
  }
}

export async function deleteSegment(id: string) {
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
    return { error: "Operation failed" };
  }
}
