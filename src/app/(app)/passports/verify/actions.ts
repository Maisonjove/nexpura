"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth-context";

// Section 10.2 (Kaitlyn 2026-05-02 brief): server action behind the
// /passports/verify form. Looks up a passport by either its
// passport_uid (legacy NXP-XXXXXX format) or its global identity_number
// (numeric 100000001+). Tenant-scoped — staff inside tenant A can only
// verify their own passports here. The public-facing /verify/[uid]
// route is the cross-tenant surface for end customers.
export type VerifyResult =
  | {
      found: true;
      data: {
        id: string;
        passport_uid: string;
        identity_number: number | null;
        title: string;
        jewellery_type: string | null;
        metal_type: string | null;
        stone_type: string | null;
        primary_image: string | null;
        status: string;
        is_public: boolean;
        verified_at: string | null;
        created_at: string;
        current_owner_name: string | null;
      };
    }
  | { found: false };

export async function verifyPassport(rawSerial: string): Promise<VerifyResult> {
  const serial = (rawSerial ?? "").trim();
  if (!serial) return { found: false };
  // Defensive cap — keep enumeration attempts cheap and prevent the
  // server action accepting unbounded user input.
  if (serial.length > 64) return { found: false };

  const auth = await getAuthContext();
  if (!auth) return { found: false };
  const { tenantId } = auth;

  const admin = createAdminClient();
  const baseColumns =
    "id, passport_uid, identity_number, title, jewellery_type, metal_type, stone_type, primary_image, status, is_public, verified_at, created_at, current_owner_name";

  // Try passport_uid first (case-insensitive — passports issued before
  // the trigger normalised case may be stored either way).
  const { data: byUid } = await admin
    .from("passports")
    .select(baseColumns)
    .eq("tenant_id", tenantId)
    .ilike("passport_uid", serial)
    .is("deleted_at", null)
    .maybeSingle();
  if (byUid) return { found: true, data: byUid as VerifyResult extends { found: true; data: infer D } ? D : never };

  // Fall back to identity_number (numeric).
  const numericId = Number.parseInt(serial, 10);
  if (!Number.isNaN(numericId) && numericId > 0) {
    const { data: byIdentity } = await admin
      .from("passports")
      .select(baseColumns)
      .eq("tenant_id", tenantId)
      .eq("identity_number", numericId)
      .is("deleted_at", null)
      .maybeSingle();
    if (byIdentity) return { found: true, data: byIdentity as VerifyResult extends { found: true; data: infer D } ? D : never };
  }

  return { found: false };
}
