import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import RemindersClientLegacy from "../../../settings/reminders/RemindersClientLegacy";
import { DEFAULT_REMINDERS } from "../../../settings/reminders/page";

export const metadata = { title: "Reminders (Before) — Feedback Review" };

export default async function RemindersBeforePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  let tenantId: string | null = null;

  if (user) {
    const { data: userData } = await admin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    tenantId = userData?.tenant_id ?? null;
  }

  let reminders = DEFAULT_REMINDERS;
  let tableExists = false;

  if (tenantId) {
    try {
      const { data, error } = await admin
        .from("service_reminders")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at");

      if (!error) {
        tableExists = true;
        if (data && data.length > 0) {
          reminders = data;
        }
      }
    } catch {
      // table doesn't exist
    }
  }

  return (
    <RemindersClientLegacy
      initialReminders={reminders}
      tenantId={tenantId}
      tableExists={tableExists}
    />
  );
}
