"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import logger from "@/lib/logger";
import { logAuditEvent } from "@/lib/audit";

export interface LocationDetails {
  id: string;
  name: string;
  type: string;
  address_line1: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  operating_hours: Record<string, { open: string; close: string; closed?: boolean }> | null;
  is_active: boolean;
}

export async function getLocationDetails(locationId: string): Promise<{ data: LocationDetails | null; error?: string }> {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: "Not authenticated" };
    }

    const { data, error } = await supabase
      .from("locations")
      .select("id, name, type, address_line1, suburb, state, postcode, country, phone, email, operating_hours, is_active")
      .eq("id", locationId)
      .single();

    if (error) {
      logger.error("Get location details error:", error);
      return { data: null, error: error.message };
    }

    return { data };
  } catch (error) {
    logger.error("getLocationDetails failed", { error });
    return { data: null, error: "Operation failed" };
  }
}

export async function addLocation(formData: {
  name: string;
  type: string;
  address_line1: string;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
  phone: string;
  email: string;
}) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Not authenticated" };
    }

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return { error: "No tenant found" };
    }

    const { data, error } = await supabase
      .from("locations")
      .insert({
        tenant_id: userData.tenant_id,
        name: formData.name,
        type: formData.type,
        address_line1: formData.address_line1 || null,
        suburb: formData.suburb || null,
        state: formData.state || null,
        postcode: formData.postcode || null,
        country: formData.country || null,
        phone: formData.phone || null,
        email: formData.email || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      logger.error("Add location error:", error);
      return { error: error.message };
    }

    await logAuditEvent({
      tenantId: userData.tenant_id,
      userId: user.id,
      action: "location_create",
      entityType: "location",
      entityId: data.id,
      newData: { name: formData.name, type: formData.type, address: formData.address_line1 },
    });

    revalidatePath("/settings/locations");
    return { data };
  } catch (error) {
    logger.error("addLocation failed", { error });
    return { error: "Operation failed" };
  }
}

export async function toggleLocationActive(locationId: string, isActive: boolean) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };
    
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    
    const { error } = await supabase
      .from("locations")
      .update({ is_active: !isActive })
      .eq("id", locationId);

    if (error) {
      logger.error("Toggle location error:", error);
      return { error: error.message };
    }

    if (userData?.tenant_id) {
      await logAuditEvent({
        tenantId: userData.tenant_id,
        userId: user.id,
        action: "location_update",
        entityType: "location",
        entityId: locationId,
        oldData: { is_active: isActive },
        newData: { is_active: !isActive },
      });
    }

    revalidatePath("/settings/locations");
    return { success: true };
  } catch (error) {
    logger.error("toggleLocationActive failed", { error });
    return { error: "Operation failed" };
  }
}

export async function updateLocation(
  locationId: string, 
  formData: {
    name: string;
    type: string;
    address_line1: string;
    suburb: string;
    state: string;
    postcode: string;
    country: string;
    phone: string;
    email: string;
    operating_hours?: Record<string, { open: string; close: string; closed?: boolean }>;
  }
) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Not authenticated" };
    }

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id, role")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return { error: "No tenant found" };
    }

    // Only owners can edit locations
    if (userData.role !== "owner") {
      return { error: "Not authorized" };
    }

    // Get old data for audit
    const { data: oldData } = await supabase
      .from("locations")
      .select("name, type, address_line1, phone, email, operating_hours")
      .eq("id", locationId)
      .eq("tenant_id", userData.tenant_id)
      .single();

    const { error } = await supabase
      .from("locations")
      .update({
        name: formData.name,
        type: formData.type,
        address_line1: formData.address_line1 || null,
        suburb: formData.suburb || null,
        state: formData.state || null,
        postcode: formData.postcode || null,
        country: formData.country || null,
        phone: formData.phone || null,
        email: formData.email || null,
        operating_hours: formData.operating_hours || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", locationId)
      .eq("tenant_id", userData.tenant_id);

    if (error) {
      logger.error("Update location error:", error);
      return { error: error.message };
    }

    await logAuditEvent({
      tenantId: userData.tenant_id,
      userId: user.id,
      action: "location_update",
      entityType: "location",
      entityId: locationId,
      oldData: oldData || undefined,
      newData: { name: formData.name, type: formData.type, address: formData.address_line1 },
    });

    revalidatePath("/settings/locations");
    revalidatePath(`/settings/locations/${locationId}`);
    return { success: true };
  } catch (error) {
    logger.error("updateLocation failed", { error });
    return { error: "Operation failed" };
  }
}
