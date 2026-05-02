"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

/**
 * Brief 2 audit security #2 — defence-in-depth on the logo URL we
 * persist. The client uploads to Supabase Storage and then calls this
 * action with the resulting URL. Trust nothing in that URL: the action
 * runs server-side and could be reached by any authenticated user
 * POSTing a forged value.
 *
 * Constraints enforced here:
 * 1. URL must be HTTPS on the configured Supabase host.
 * 2. Path must reference the public `logos/` bucket.
 * 3. Path inside the bucket must start with `<tenantId>/` — preventing
 *    one tenant from pointing their logo at another tenant's file.
 * 4. Extension must be png or svg — matches the client allowlist.
 *
 * `null` is allowed (clears the logo).
 */
const SUPABASE_HOST = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
})();

function validateLogoUrl(logoUrl: string, tenantId: string): void {
  let parsed: URL;
  try {
    parsed = new URL(logoUrl);
  } catch {
    throw new Error("Invalid logo URL");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Logo URL must be HTTPS");
  }
  if (SUPABASE_HOST && parsed.host !== SUPABASE_HOST) {
    throw new Error("Logo URL must be on the configured Supabase host");
  }
  // Path shape: /storage/v1/object/public/logos/<tenantId>/<...>.<ext>
  const expectedPrefix = `/storage/v1/object/public/logos/${tenantId}/`;
  if (!parsed.pathname.startsWith(expectedPrefix)) {
    throw new Error(
      "Logo URL must reference this tenant's logos/ folder",
    );
  }
  const ext = parsed.pathname.split(".").pop()?.toLowerCase() ?? "";
  if (ext !== "png" && ext !== "svg") {
    throw new Error("Logo must be PNG or SVG");
  }
}

export async function updateTenantLogo(logoUrl: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) throw new Error("No tenant found");

  if (logoUrl !== null) {
    validateLogoUrl(logoUrl, userData.tenant_id);
  }

  const { error } = await supabase
    .from("tenants")
    .update({ logo_url: logoUrl })
    .eq("id", userData.tenant_id);

  if (error) throw error;
  revalidatePath("/settings");
}
