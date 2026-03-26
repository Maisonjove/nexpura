/**
 * Run this script once to create the service_reminders table.
 * node create-service-reminders.mjs
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://vkpjocnrefjfpuovzinn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrcGpvY25yZWZqZnB1b3Z6aW5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIyMTIwNywiZXhwIjoyMDg4Nzk3MjA3fQ.5M-a0_dB0xxx8dHO_X-l8ePcKhyIZ-T38IC85BTcFEo"
);

// Check if table already exists
const { data: existing, error: checkError } = await supabase
  .from("service_reminders")
  .select("id")
  .limit(1);

if (!checkError) {
  console.log("✅ service_reminders table already exists");
  process.exit(0);
}

if (checkError.code !== "PGRST205") {
  console.error("Unexpected error checking table:", checkError);
  process.exit(1);
}

console.log("Table does not exist. Creating via Supabase Dashboard is required.");
console.log("");
console.log("Please run the following SQL in the Supabase Dashboard SQL editor:");
console.log("https://supabase.com/dashboard/project/vkpjocnrefjfpuovzinn/sql/new");
console.log("");
console.log(`
CREATE TABLE IF NOT EXISTS public.service_reminders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'event',
  trigger_type text NOT NULL DEFAULT 'event',
  trigger_value text,
  status text NOT NULL DEFAULT 'active',
  channel text NOT NULL DEFAULT 'email',
  subject text,
  body text,
  days_before int,
  days_after int,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS service_reminders_tenant_id_idx ON public.service_reminders(tenant_id);
ALTER TABLE public.service_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.service_reminders
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));
`);
