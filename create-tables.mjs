import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://vkpjocnrefjfpuovzinn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrcGpvY25yZWZqZnB1b3Z6aW5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIyMTIwNywiZXhwIjoyMDg4Nzk3MjA3fQ.5M-a0_dB0xxx8dHO_X-l8ePcKhyIZ-T38IC85BTcFEo"
);

// First, create an RPC function that can execute SQL
const createFunctionSQL = `
CREATE OR REPLACE FUNCTION run_sql(query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE query;
END;
$$;
`;

async function main() {
  console.log("Attempting to check existing tables...");

  // Check if qa_categories already exists via a direct select
  const { data, error } = await supabase.from("qa_categories").select("id").limit(1);
  
  if (!error) {
    console.log("Tables already exist. Ready to seed data.");
    return true;
  }
  
  if (error.code === "42P01") {
    console.log("Tables don't exist. You need to create them via Supabase Dashboard.");
    console.log("\n=== INSTRUCTIONS ===");
    console.log("1. Go to: https://supabase.com/dashboard/project/vkpjocnrefjfpuovzinn/sql/new");
    console.log("2. Copy and paste the SQL from: supabase/migrations/20260321_qa_checklist.sql");
    console.log("3. Click 'Run'");
    console.log("4. Then re-run this script to seed the data.\n");
    return false;
  }

  console.log("Error:", error);
  return false;
}

main().then(exists => {
  if (exists) {
    // Run seeding
    import("./seed-qa.mjs");
  }
});
