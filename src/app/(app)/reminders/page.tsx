import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-context";
import RemindersClient from "./RemindersClient";

export const metadata = { title: "Reminders — Nexpura" };

export default async function RemindersPage() {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");

  const { userId, tenantId } = auth;
  const admin = createAdminClient();

  // Fetch upcoming reminders from multiple sources
  const now = new Date().toISOString();
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    // Tasks with due dates
    upcomingTasks,
    // Repairs ready for collection (pending pickup)
    readyRepairs,
    // Bespoke jobs ready
    readyBespoke,
    // Laybys with upcoming payments
    upcomingLaybys,
    // Customer birthdays/anniversaries this month
    customerEvents,
  ] = await Promise.all([
    // Tasks due soon
    admin
      .from("tasks")
      .select("id, title, description, due_date, priority, status, linked_type, linked_id")
      .eq("tenant_id", tenantId)
      .eq("assigned_to", userId)
      .in("status", ["pending", "in_progress"])
      .not("due_date", "is", null)
      .lte("due_date", nextWeek)
      .order("due_date", { ascending: true })
      .limit(20),

    // Repairs ready for collection
    admin
      .from("repairs")
      .select(`
        id, repair_number, item_description, stage, tracking_id,
        customer:customers!repairs_customer_id_fkey(id, first_name, last_name, phone, email)
      `)
      .eq("tenant_id", tenantId)
      .eq("stage", "ready_for_collection")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(20),

    // Bespoke ready
    admin
      .from("bespoke_jobs")
      .select(`
        id, bespoke_number, description, stage, tracking_id,
        customer:customers!bespoke_jobs_customer_id_fkey(id, first_name, last_name, phone, email)
      `)
      .eq("tenant_id", tenantId)
      .eq("stage", "ready_for_collection")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(20),

    // Laybys with payments due
    admin
      .from("laybys")
      .select(`
        id, layby_number, total_amount, amount_paid, next_payment_due,
        customer:customers!laybys_customer_id_fkey(id, first_name, last_name, phone)
      `)
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .not("next_payment_due", "is", null)
      .lte("next_payment_due", nextMonth)
      .order("next_payment_due", { ascending: true })
      .limit(20),

    // Customer events (birthdays/anniversaries)
    admin
      .from("customers")
      .select("id, first_name, last_name, phone, email, birthday, anniversary")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .or(`birthday.not.is.null,anniversary.not.is.null`)
      .limit(100),
  ]);

  // Process customer events to find ones this month
  const today = new Date();
  const thisMonth = today.getMonth();
  const thisDay = today.getDate();
  
  const upcomingCustomerEvents = (customerEvents.data || [])
    .flatMap((c) => {
      const events: Array<{
        type: "birthday" | "anniversary";
        customerId: string;
        customerName: string;
        phone: string | null;
        email: string | null;
        date: string;
        daysUntil: number;
      }> = [];

      if (c.birthday) {
        const bday = new Date(c.birthday);
        const bdayThisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
        const daysUntil = Math.ceil((bdayThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntil >= 0 && daysUntil <= 30) {
          events.push({
            type: "birthday",
            customerId: c.id,
            customerName: `${c.first_name} ${c.last_name}`.trim(),
            phone: c.phone,
            email: c.email,
            date: c.birthday,
            daysUntil,
          });
        }
      }

      if (c.anniversary) {
        const anniv = new Date(c.anniversary);
        const annivThisYear = new Date(today.getFullYear(), anniv.getMonth(), anniv.getDate());
        const daysUntil = Math.ceil((annivThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntil >= 0 && daysUntil <= 30) {
          events.push({
            type: "anniversary",
            customerId: c.id,
            customerName: `${c.first_name} ${c.last_name}`.trim(),
            phone: c.phone,
            email: c.email,
            date: c.anniversary,
            daysUntil,
          });
        }
      }

      return events;
    })
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 20);

  // Transform data to handle Supabase join returning arrays
  const transformedRepairs = (readyRepairs.data || []).map((r: any) => ({
    ...r,
    customer: Array.isArray(r.customer) ? r.customer[0] || null : r.customer,
  }));

  const transformedBespoke = (readyBespoke.data || []).map((b: any) => ({
    ...b,
    customer: Array.isArray(b.customer) ? b.customer[0] || null : b.customer,
  }));

  const transformedLaybys = (upcomingLaybys.data || []).map((l: any) => ({
    ...l,
    customer: Array.isArray(l.customer) ? l.customer[0] || null : l.customer,
  }));

  return (
    <RemindersClient
      tasks={upcomingTasks.data || []}
      readyRepairs={transformedRepairs}
      readyBespoke={transformedBespoke}
      upcomingLaybys={transformedLaybys}
      customerEvents={upcomingCustomerEvents}
    />
  );
}
