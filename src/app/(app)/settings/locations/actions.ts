"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import logger from "@/lib/logger";
import { logAuditEvent } from "@/lib/audit";

// ============================================================================
// TYPES
// ============================================================================

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

interface LocationFormData {
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

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

const MAX_NAME_LENGTH = 100;
const MAX_ADDRESS_LENGTH = 200;
const MAX_FIELD_LENGTH = 100;
const VALID_LOCATION_TYPES = ["showroom", "workshop", "warehouse", "office", "retail", "other"];

function sanitizeString(str: string | undefined | null, maxLength: number): string | null {
  if (!str || typeof str !== "string") return null;
  // Trim and limit length
  const trimmed = str.trim().slice(0, maxLength);
  // Basic sanitization - remove control characters
  return trimmed.replace(/[\x00-\x1F\x7F]/g, "");
}

function validateLocationId(id: string): boolean {
  // UUID v4 format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof id === "string" && uuidRegex.test(id);
}

function validateEmail(email: string | null): boolean {
  if (!email) return true; // Optional field
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePhone(phone: string | null): boolean {
  if (!phone) return true; // Optional field
  // Allow common phone formats
  const phoneRegex = /^[\d\s\-+().]{5,20}$/;
  return phoneRegex.test(phone);
}

// ============================================================================
// AUTH HELPER
// ============================================================================

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { error: "Not authenticated", supabase: null, user: null, userData: null };
  }

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (userError || !userData?.tenant_id) {
    return { error: "No tenant found", supabase: null, user: null, userData: null };
  }

  return { error: null, supabase, user, userData };
}

// ============================================================================
// SERVER ACTIONS
// ============================================================================

export async function getLocationDetails(locationId: string): Promise<{ data: LocationDetails | null; error?: string }> {
  try {
    // Validate input
    if (!validateLocationId(locationId)) {
      return { data: null, error: "Invalid location ID" };
    }

    const { error: authError, supabase, userData } = await getAuthenticatedUser();
    if (authError || !supabase || !userData) {
      return { data: null, error: authError || "Authentication failed" };
    }

    // Always filter by tenant_id for security
    const { data, error } = await supabase
      .from("locations")
      .select("id, name, type, address_line1, suburb, state, postcode, country, phone, email, operating_hours, is_active")
      .eq("id", locationId)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { data: null, error: "Location not found" };
      }
      logger.error("Get location details error:", error);
      return { data: null, error: "Failed to fetch location" };
    }

    return { data };
  } catch (error) {
    logger.error("getLocationDetails failed", { error });
    return { data: null, error: "Operation failed" };
  }
}

export async function addLocation(formData: LocationFormData): Promise<{ data?: LocationDetails; error?: string }> {
  try {
    const { error: authError, supabase, user, userData } = await getAuthenticatedUser();
    if (authError || !supabase || !user || !userData) {
      return { error: authError || "Authentication failed" };
    }

    // Only owners and managers can add locations
    if (!["owner", "manager"].includes(userData.role)) {
      return { error: "Not authorized to add locations" };
    }

    // Validate and sanitize inputs
    const name = sanitizeString(formData.name, MAX_NAME_LENGTH);
    if (!name || name.length < 1) {
      return { error: "Location name is required" };
    }

    const type = VALID_LOCATION_TYPES.includes(formData.type) ? formData.type : "other";
    const address_line1 = sanitizeString(formData.address_line1, MAX_ADDRESS_LENGTH);
    const suburb = sanitizeString(formData.suburb, MAX_FIELD_LENGTH);
    const state = sanitizeString(formData.state, MAX_FIELD_LENGTH);
    const postcode = sanitizeString(formData.postcode, 20);
    const country = sanitizeString(formData.country, MAX_FIELD_LENGTH);
    const phone = sanitizeString(formData.phone, 30);
    const email = sanitizeString(formData.email, MAX_FIELD_LENGTH);

    // Validate email and phone formats
    if (email && !validateEmail(email)) {
      return { error: "Invalid email format" };
    }
    if (phone && !validatePhone(phone)) {
      return { error: "Invalid phone format" };
    }

    // Check location limit (prevent spam)
    const { count: locationCount } = await supabase
      .from("locations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", userData.tenant_id);

    if (locationCount && locationCount >= 50) {
      return { error: "Maximum location limit reached (50)" };
    }

    // Insert with tenant isolation
    const { data, error } = await supabase
      .from("locations")
      .insert({
        tenant_id: userData.tenant_id,
        name,
        type,
        address_line1,
        suburb,
        state,
        postcode,
        country,
        phone,
        email,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      logger.error("Add location error:", error);
      if (error.code === "23505") {
        return { error: "A location with this name already exists" };
      }
      return { error: "Failed to create location" };
    }

    // Audit log (non-blocking)
    logAuditEvent({
      tenantId: userData.tenant_id,
      userId: user.id,
      action: "location_create",
      entityType: "location",
      entityId: data.id,
      newData: { name, type, address: address_line1 },
    }).catch((e) => logger.error("Audit log failed", { error: e }));

    revalidatePath("/settings/locations");
    return { data };
  } catch (error) {
    logger.error("addLocation failed", { error });
    return { error: "Operation failed" };
  }
}

export async function toggleLocationActive(locationId: string, isActive: boolean): Promise<{ success?: boolean; error?: string }> {
  try {
    // Validate input
    if (!validateLocationId(locationId)) {
      return { error: "Invalid location ID" };
    }

    const { error: authError, supabase, user, userData } = await getAuthenticatedUser();
    if (authError || !supabase || !user || !userData) {
      return { error: authError || "Authentication failed" };
    }

    // Only owners can toggle location status
    if (userData.role !== "owner") {
      return { error: "Not authorized" };
    }

    // Verify location belongs to tenant before updating
    const { data: existingLocation, error: fetchError } = await supabase
      .from("locations")
      .select("id, name, is_active")
      .eq("id", locationId)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (fetchError || !existingLocation) {
      return { error: "Location not found" };
    }

    // Update with tenant isolation
    const { error } = await supabase
      .from("locations")
      .update({ 
        is_active: !isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", locationId)
      .eq("tenant_id", userData.tenant_id);

    if (error) {
      logger.error("Toggle location error:", error);
      return { error: "Failed to update location" };
    }

    // Audit log (non-blocking)
    logAuditEvent({
      tenantId: userData.tenant_id,
      userId: user.id,
      action: "location_update",
      entityType: "location",
      entityId: locationId,
      oldData: { is_active: isActive },
      newData: { is_active: !isActive },
    }).catch((e) => logger.error("Audit log failed", { error: e }));

    revalidatePath("/settings/locations");
    return { success: true };
  } catch (error) {
    logger.error("toggleLocationActive failed", { error });
    return { error: "Operation failed" };
  }
}

export async function deleteLocation(locationId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    // Validate input
    if (!validateLocationId(locationId)) {
      return { error: "Invalid location ID" };
    }

    const { error: authError, supabase, user, userData } = await getAuthenticatedUser();
    if (authError || !supabase || !user || !userData) {
      return { error: authError || "Authentication failed" };
    }

    // Only owners can delete locations
    if (userData.role !== "owner") {
      return { error: "Not authorized" };
    }

    // First verify location belongs to tenant
    const { data: locationData, error: locationError } = await supabase
      .from("locations")
      .select("id, name, is_active")
      .eq("id", locationId)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (locationError || !locationData) {
      return { error: "Location not found" };
    }

    // Must archive before delete
    if (locationData.is_active) {
      return { error: "Please archive the location before deleting" };
    }

    // Check for linked data in parallel (with tenant isolation)
    const [salesCheck, repairsCheck, bespokeCheck, inventoryCheck] = await Promise.all([
      supabase
        .from("sales")
        .select("id", { count: "exact", head: true })
        .eq("location_id", locationId)
        .eq("tenant_id", userData.tenant_id),
      supabase
        .from("repairs")
        .select("id", { count: "exact", head: true })
        .eq("location_id", locationId)
        .eq("tenant_id", userData.tenant_id),
      supabase
        .from("bespoke_jobs")
        .select("id", { count: "exact", head: true })
        .eq("location_id", locationId)
        .eq("tenant_id", userData.tenant_id),
      supabase
        .from("inventory")
        .select("id", { count: "exact", head: true })
        .eq("location_id", locationId)
        .eq("tenant_id", userData.tenant_id),
    ]);

    const linkedCounts = {
      sales: salesCheck.count || 0,
      repairs: repairsCheck.count || 0,
      jobs: bespokeCheck.count || 0,
      inventory: inventoryCheck.count || 0,
    };

    const totalLinked = linkedCounts.sales + linkedCounts.repairs + linkedCounts.jobs + linkedCounts.inventory;

    if (totalLinked > 0) {
      const details = [];
      if (linkedCounts.sales > 0) details.push(`${linkedCounts.sales} sales`);
      if (linkedCounts.repairs > 0) details.push(`${linkedCounts.repairs} repairs`);
      if (linkedCounts.jobs > 0) details.push(`${linkedCounts.jobs} jobs`);
      if (linkedCounts.inventory > 0) details.push(`${linkedCounts.inventory} inventory items`);
      
      return { 
        error: `Cannot delete: location has ${details.join(", ")}. Archive it instead to preserve history.` 
      };
    }

    // Safe to delete
    const { error } = await supabase
      .from("locations")
      .delete()
      .eq("id", locationId)
      .eq("tenant_id", userData.tenant_id);

    if (error) {
      logger.error("Delete location error:", error);
      return { error: "Failed to delete location" };
    }

    // Audit log (non-blocking)
    logAuditEvent({
      tenantId: userData.tenant_id,
      userId: user.id,
      action: "location_delete",
      entityType: "location",
      entityId: locationId,
      oldData: { name: locationData.name },
    }).catch((e) => logger.error("Audit log failed", { error: e }));

    revalidatePath("/settings/locations");
    return { success: true };
  } catch (error) {
    logger.error("deleteLocation failed", { error });
    return { error: "Operation failed" };
  }
}

export async function updateLocation(
  locationId: string, 
  formData: LocationFormData
): Promise<{ success?: boolean; error?: string }> {
  try {
    // Validate input
    if (!validateLocationId(locationId)) {
      return { error: "Invalid location ID" };
    }

    const { error: authError, supabase, user, userData } = await getAuthenticatedUser();
    if (authError || !supabase || !user || !userData) {
      return { error: authError || "Authentication failed" };
    }

    // Only owners can edit locations
    if (userData.role !== "owner") {
      return { error: "Not authorized" };
    }

    // Validate and sanitize inputs
    const name = sanitizeString(formData.name, MAX_NAME_LENGTH);
    if (!name || name.length < 1) {
      return { error: "Location name is required" };
    }

    const type = VALID_LOCATION_TYPES.includes(formData.type) ? formData.type : "other";
    const address_line1 = sanitizeString(formData.address_line1, MAX_ADDRESS_LENGTH);
    const suburb = sanitizeString(formData.suburb, MAX_FIELD_LENGTH);
    const state = sanitizeString(formData.state, MAX_FIELD_LENGTH);
    const postcode = sanitizeString(formData.postcode, 20);
    const country = sanitizeString(formData.country, MAX_FIELD_LENGTH);
    const phone = sanitizeString(formData.phone, 30);
    const email = sanitizeString(formData.email, MAX_FIELD_LENGTH);

    // Validate email and phone formats
    if (email && !validateEmail(email)) {
      return { error: "Invalid email format" };
    }
    if (phone && !validatePhone(phone)) {
      return { error: "Invalid phone format" };
    }

    // Get old data for audit (with tenant isolation)
    const { data: oldData, error: fetchError } = await supabase
      .from("locations")
      .select("name, type, address_line1, phone, email, operating_hours")
      .eq("id", locationId)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (fetchError || !oldData) {
      return { error: "Location not found" };
    }

    // Update with tenant isolation
    const { error } = await supabase
      .from("locations")
      .update({
        name,
        type,
        address_line1,
        suburb,
        state,
        postcode,
        country,
        phone,
        email,
        operating_hours: formData.operating_hours || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", locationId)
      .eq("tenant_id", userData.tenant_id);

    if (error) {
      logger.error("Update location error:", error);
      if (error.code === "23505") {
        return { error: "A location with this name already exists" };
      }
      return { error: "Failed to update location" };
    }

    // Audit log (non-blocking)
    logAuditEvent({
      tenantId: userData.tenant_id,
      userId: user.id,
      action: "location_update",
      entityType: "location",
      entityId: locationId,
      oldData,
      newData: { name, type, address: address_line1 },
    }).catch((e) => logger.error("Audit log failed", { error: e }));

    revalidatePath("/settings/locations");
    revalidatePath(`/settings/locations/${locationId}`);
    return { success: true };
  } catch (error) {
    logger.error("updateLocation failed", { error });
    return { error: "Operation failed" };
  }
}
