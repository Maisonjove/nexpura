"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendPassportEmail } from "@/lib/email/send";
import logger from "@/lib/logger";

async function getTenantAndUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!data?.tenant_id) throw new Error("No tenant");
  return { supabase, userId: user.id, tenantId: data.tenant_id as string };
}

export async function createPassport(formData: FormData): Promise<void> {
  try {
    const { supabase, userId, tenantId } = await getTenantAndUser();

  // Generate UID via postgres function
  const { data: uidData, error: uidError } = await supabase.rpc(
    "generate_passport_uid"
  );
  if (uidError || !uidData) throw new Error("Failed to generate passport UID");
  const passportUid = uidData as string;

  const title = formData.get("title") as string;
  const jewelleryType = (formData.get("jewellery_type") as string) || null;
  const description = (formData.get("description") as string) || null;

  const metalType = (formData.get("metal_type") as string) || null;
  const metalColour = (formData.get("metal_colour") as string) || null;
  const metalPurity = (formData.get("metal_purity") as string) || null;
  const metalWeightRaw = formData.get("metal_weight_grams") as string | null;
  const metalWeight = metalWeightRaw ? parseFloat(metalWeightRaw) : null;

  const stoneType = (formData.get("stone_type") as string) || null;
  const stoneShape = (formData.get("stone_shape") as string) || null;
  const stoneCaratRaw = formData.get("stone_carat") as string | null;
  const stoneCarat = stoneCaratRaw ? parseFloat(stoneCaratRaw) : null;
  const stoneColour = (formData.get("stone_colour") as string) || null;
  const stoneClarity = (formData.get("stone_clarity") as string) || null;
  const stoneOrigin = (formData.get("stone_origin") as string) || null;
  const stoneCertNumber = (formData.get("stone_cert_number") as string) || null;

  const ringSize = (formData.get("ring_size") as string) || null;
  const settingStyle = (formData.get("setting_style") as string) || null;

  const makerName = (formData.get("maker_name") as string) || null;
  const madeIn = (formData.get("made_in") as string) || "Australia";
  const yearMadeRaw = formData.get("year_made") as string | null;
  const yearMade = yearMadeRaw ? parseInt(yearMadeRaw) : null;

  const currentOwnerName =
    (formData.get("current_owner_name") as string) || null;
  const currentOwnerEmail =
    (formData.get("current_owner_email") as string) || null;
  const purchaseDateRaw = formData.get("purchase_date") as string | null;
  const purchaseDate = purchaseDateRaw || null;
  const purchasePriceRaw = formData.get("purchase_price") as string | null;
  const purchasePrice = purchasePriceRaw ? parseFloat(purchasePriceRaw) : null;

  const isPublic = formData.get("is_public") !== "false";

  const { data: passport, error: insertError } = await supabase
    .from("passports")
    .insert({
      tenant_id: tenantId,
      passport_uid: passportUid,
      title,
      jewellery_type: jewelleryType,
      description,
      metal_type: metalType,
      metal_colour: metalColour,
      metal_purity: metalPurity,
      metal_weight_grams: metalWeight,
      stone_type: stoneType,
      stone_shape: stoneShape,
      stone_carat: stoneCarat,
      stone_colour: stoneColour,
      stone_clarity: stoneClarity,
      stone_origin: stoneOrigin,
      stone_cert_number: stoneCertNumber,
      ring_size: ringSize,
      setting_style: settingStyle,
      maker_name: makerName,
      made_in: madeIn,
      year_made: yearMade,
      current_owner_name: currentOwnerName,
      current_owner_email: currentOwnerEmail,
      purchase_date: purchaseDate,
      purchase_price: purchasePrice,
      is_public: isPublic,
      created_by: userId,
    })
    .select("id")
    .single();

  if (insertError || !passport) throw new Error("Failed to create passport");

  // Insert created event
  await supabase.from("passport_events").insert({
    passport_id: passport.id,
    tenant_id: tenantId,
    event_type: "created",
    event_data: { title, jewellery_type: jewelleryType },
    created_by: userId,
  });

  // Send passport email to owner if email is set
  if (currentOwnerEmail) {
    await sendPassportEmail(passport.id);
  }

  revalidatePath("/passports");
    redirect(`/passports/${passport.id}`);
  } catch (err) {
    logger.error("[createPassport] Error:", err);
    throw err; // Re-throw for redirect to work
  }
}

export async function updatePassport(id: string, formData: FormData): Promise<void> {
  try {
  const { supabase, userId, tenantId } = await getTenantAndUser();

  const title = formData.get("title") as string;
  const jewelleryType = (formData.get("jewellery_type") as string) || null;
  const description = (formData.get("description") as string) || null;

  const metalType = (formData.get("metal_type") as string) || null;
  const metalColour = (formData.get("metal_colour") as string) || null;
  const metalPurity = (formData.get("metal_purity") as string) || null;
  const metalWeightRaw = formData.get("metal_weight_grams") as string | null;
  const metalWeight = metalWeightRaw ? parseFloat(metalWeightRaw) : null;

  const stoneType = (formData.get("stone_type") as string) || null;
  const stoneShape = (formData.get("stone_shape") as string) || null;
  const stoneCaratRaw = formData.get("stone_carat") as string | null;
  const stoneCarat = stoneCaratRaw ? parseFloat(stoneCaratRaw) : null;
  const stoneColour = (formData.get("stone_colour") as string) || null;
  const stoneClarity = (formData.get("stone_clarity") as string) || null;
  const stoneOrigin = (formData.get("stone_origin") as string) || null;
  const stoneCertNumber = (formData.get("stone_cert_number") as string) || null;

  const ringSize = (formData.get("ring_size") as string) || null;
  const settingStyle = (formData.get("setting_style") as string) || null;

  const makerName = (formData.get("maker_name") as string) || null;
  const madeIn = (formData.get("made_in") as string) || "Australia";
  const yearMadeRaw = formData.get("year_made") as string | null;
  const yearMade = yearMadeRaw ? parseInt(yearMadeRaw) : null;

  const currentOwnerName =
    (formData.get("current_owner_name") as string) || null;
  const currentOwnerEmail =
    (formData.get("current_owner_email") as string) || null;
  const purchaseDateRaw = formData.get("purchase_date") as string | null;
  const purchaseDate = purchaseDateRaw || null;
  const purchasePriceRaw = formData.get("purchase_price") as string | null;
  const purchasePrice = purchasePriceRaw ? parseFloat(purchasePriceRaw) : null;

  const isPublic = formData.get("is_public") !== "false";

  const { error } = await supabase
    .from("passports")
    .update({
      title,
      jewellery_type: jewelleryType,
      description,
      metal_type: metalType,
      metal_colour: metalColour,
      metal_purity: metalPurity,
      metal_weight_grams: metalWeight,
      stone_type: stoneType,
      stone_shape: stoneShape,
      stone_carat: stoneCarat,
      stone_colour: stoneColour,
      stone_clarity: stoneClarity,
      stone_origin: stoneOrigin,
      stone_cert_number: stoneCertNumber,
      ring_size: ringSize,
      setting_style: settingStyle,
      maker_name: makerName,
      made_in: madeIn,
      year_made: yearMade,
      current_owner_name: currentOwnerName,
      current_owner_email: currentOwnerEmail,
      purchase_date: purchaseDate,
      purchase_price: purchasePrice,
      is_public: isPublic,
    })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) throw new Error("Failed to update passport");

  // Insert updated event
  await supabase.from("passport_events").insert({
    passport_id: id,
    tenant_id: tenantId,
    event_type: "updated",
    event_data: { title },
    created_by: userId,
  });

  revalidatePath(`/passports/${id}`);
    revalidatePath("/passports");
    redirect(`/passports/${id}`);
  } catch (err) {
    logger.error("[updatePassport] Error:", err);
    throw err;
  }
}

export async function addPassportEvent(
  passportId: string,
  eventType: string,
  notes: string,
  eventData: Record<string, unknown> = {}
) {
  const { supabase, userId, tenantId } = await getTenantAndUser();

  const { error } = await supabase.from("passport_events").insert({
    passport_id: passportId,
    tenant_id: tenantId,
    event_type: eventType,
    notes: notes || null,
    event_data: eventData,
    created_by: userId,
  });

  if (error) throw new Error("Failed to add passport event");

  revalidatePath(`/passports/${passportId}`);
}

export async function transferOwnership(
  passportId: string,
  newOwnerName: string,
  newOwnerEmail: string,
  notes: string
) {
  const { supabase, userId, tenantId } = await getTenantAndUser();

  // Get current owner for the event data
  const { data: passport } = await supabase
    .from("passports")
    .select("current_owner_name, current_owner_email")
    .eq("id", passportId)
    .single();

  const { error } = await supabase
    .from("passports")
    .update({
      current_owner_name: newOwnerName || null,
      current_owner_email: newOwnerEmail || null,
    })
    .eq("id", passportId)
    .eq("tenant_id", tenantId);

  if (error) throw new Error("Failed to transfer ownership");

  await supabase.from("passport_events").insert({
    passport_id: passportId,
    tenant_id: tenantId,
    event_type: "ownership_transferred",
    notes: notes || null,
    event_data: {
      previous_owner_name: passport?.current_owner_name,
      previous_owner_email: passport?.current_owner_email,
      new_owner_name: newOwnerName,
      new_owner_email: newOwnerEmail,
    },
    created_by: userId,
  });

  revalidatePath(`/passports/${passportId}`);
}

export async function togglePublicStatus(
  passportId: string,
  isPublic: boolean
) {
  const { supabase, tenantId } = await getTenantAndUser();

  const { error } = await supabase
    .from("passports")
    .update({ is_public: isPublic })
    .eq("id", passportId)
    .eq("tenant_id", tenantId);

  if (error) throw new Error("Failed to toggle public status");

  revalidatePath(`/passports/${passportId}`);
}

export async function savePassportPrimaryImage(
  passportId: string,
  imageUrl: string | null
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: userData } = await createAdminClient()
    .from("users").select("tenant_id").eq("id", user.id).single();
  if (!userData?.tenant_id) return { error: "No tenant" };

  const { error } = await supabase
    .from("passports")
    .update({ primary_image: imageUrl })
    .eq("id", passportId)
    .eq("tenant_id", userData.tenant_id);
  if (error) return { error: error.message };
  revalidatePath(`/passports/${passportId}`);
  return { success: true };
}

export async function savePassportImages(
  passportId: string,
  images: string[]
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: userData } = await createAdminClient()
    .from("users").select("tenant_id").eq("id", user.id).single();
  if (!userData?.tenant_id) return { error: "No tenant" };

  const { error } = await supabase
    .from("passports")
    .update({ images })
    .eq("id", passportId)
    .eq("tenant_id", userData.tenant_id);
  if (error) return { error: error.message };
  revalidatePath(`/passports/${passportId}`);
  return { success: true };
}

export async function resendPassportEmail(
  passportId: string
): Promise<{ success?: boolean; error?: string }> {
  // Verify ownership via the regular client first
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: userData } = await createAdminClient()
    .from("users").select("tenant_id").eq("id", user.id).single();
  if (!userData?.tenant_id) return { error: "No tenant" };

  // Check passport belongs to this tenant
  const { data: passport } = await supabase
    .from("passports")
    .select("id, current_owner_email")
    .eq("id", passportId)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (!passport) return { error: "Passport not found" };
  if (!passport.current_owner_email) return { error: "No owner email address set on this passport" };

  return sendPassportEmail(passportId);
}
