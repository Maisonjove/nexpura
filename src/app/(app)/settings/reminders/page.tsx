import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import RemindersClient from "./RemindersClient";

export const metadata = { title: "Service Reminders — Nexpura" };

export const DEFAULT_REMINDERS = [
  {
    id: "default-1",
    name: "Birthday Greetings",
    type: "Annual",
    trigger_type: "birthday",
    trigger_value: "0",
    status: "active",
    channel: "email",
    subject: "Happy Birthday from {business_name}! 🎂",
    body: "Hi {first_name}, wishing you a wonderful birthday! As a thank you for your loyalty, here's a special offer just for you.",
  },
  {
    id: "default-2",
    name: "Anniversary Wishes",
    type: "Annual",
    trigger_type: "anniversary",
    trigger_value: "0",
    status: "active",
    channel: "email",
    subject: "Happy Anniversary! 💍",
    body: "Hi {first_name}, congratulations on your special anniversary! We hope the jewellery we've provided has been a treasured part of your celebrations.",
  },
  {
    id: "default-3",
    name: "Jewellery Service Due",
    type: "Recurring",
    trigger_type: "purchase_anniversary",
    trigger_value: "12m",
    status: "inactive",
    channel: "email",
    subject: "Time to service your jewellery",
    body: "Hi {first_name}, it's been 12 months since your purchase. We recommend bringing your piece in for a professional clean and inspection.",
  },
  {
    id: "default-4",
    name: "Layby Payment Due",
    type: "Event",
    trigger_type: "layby_due",
    trigger_value: "3d",
    status: "active",
    channel: "sms",
    subject: "Layby payment reminder",
    body: "Hi {first_name}, your layby payment of {amount} is due in 3 days. Please visit us or call to arrange payment.",
  },
];

export default async function RemindersPage() {
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

  // Try to fetch from DB, fall back to defaults if table doesn't exist yet
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
        // If no reminders configured yet, show defaults
        if (data && data.length > 0) {
          reminders = data;
        }
      }
    } catch {
      // Table doesn't exist yet — use defaults
    }
  }

  return (
    <RemindersClient
      initialReminders={reminders}
      tenantId={tenantId}
      tableExists={tableExists}
    />
  );
}
