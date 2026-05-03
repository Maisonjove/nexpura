import CommunicationForm from "../CommunicationForm";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = { title: "New Message — Nexpura" };

export default async function NewCommunicationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  const tenantId = userData?.tenant_id;
  if (!tenantId) redirect("/onboarding");

  const [{ data: templates }, { data: customers }, { data: segments }] = await Promise.all([
    admin
      .from("email_templates")
      .select("id, name, template_type, subject, body, variables, is_system")
      .eq("tenant_id", tenantId)
      .order("is_system", { ascending: false })
      .order("name", { ascending: true }),
    // Limit individual-customer dropdown to the most recently active 200
    // — anything bigger lives behind segment selection.
    admin
      .from("customers")
      .select("id, full_name, email")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .not("email", "is", null)
      .order("updated_at", { ascending: false })
      .limit(200),
    admin
      .from("customer_segments")
      .select("id, name, description, customer_count")
      .eq("tenant_id", tenantId)
      .order("name"),
  ]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-semibold text-2xl text-stone-900">New Message</h1>
        <p className="text-stone-500 mt-1 text-sm">
          Send an email or log an internal note. Use a template to populate body + variables.
        </p>
      </div>
      <CommunicationForm
        templates={(templates ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          templateType: t.template_type,
          subject: t.subject,
          body: t.body,
          variables: (t.variables as string[]) ?? [],
        }))}
        customers={(customers ?? []).map((c) => ({
          id: c.id,
          fullName: c.full_name,
          email: c.email,
        }))}
        segments={(segments ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          customerCount: s.customer_count ?? 0,
        }))}
      />
    </div>
  );
}
