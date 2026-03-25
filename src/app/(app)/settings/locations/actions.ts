"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import logger from "@/lib/logger";

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

  revalidatePath("/settings/locations");
  return { data };
}

export async function toggleLocationActive(locationId: string, isActive: boolean) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from("locations")
    .update({ is_active: !isActive })
    .eq("id", locationId);

  if (error) {
    logger.error("Toggle location error:", error);
    return { error: error.message };
  }

  revalidatePath("/settings/locations");
  return { success: true };
}
