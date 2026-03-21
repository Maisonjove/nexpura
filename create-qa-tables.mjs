// Create QA tables using Supabase SQL query directly
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://vkpjocnrefjfpuovzinn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrcGpvY25yZWZqZnB1b3Z6aW5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIyMTIwNywiZXhwIjoyMDg4Nzk3MjA3fQ.5M-a0_dB0xxx8dHO_X-l8ePcKhyIZ-T38IC85BTcFEo"
);

const createTableSQL = `
-- QA Categories table
CREATE TABLE IF NOT EXISTS qa_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- QA Checklist Items table
CREATE TABLE IF NOT EXISTS qa_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES qa_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  route TEXT,
  testing_guidance TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- QA Test Results table
CREATE TABLE IF NOT EXISTS qa_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id UUID REFERENCES qa_checklist_items(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pass', 'fail', 'pending', 'blocked')),
  notes TEXT,
  screenshot_url TEXT,
  tester_name TEXT,
  tester_email TEXT,
  tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_qa_items_category ON qa_checklist_items(category_id);
CREATE INDEX IF NOT EXISTS idx_qa_results_item ON qa_test_results(checklist_item_id);
CREATE INDEX IF NOT EXISTS idx_qa_results_status ON qa_test_results(status);
CREATE INDEX IF NOT EXISTS idx_qa_items_priority ON qa_checklist_items(priority);

-- Enable RLS but allow all access for now (internal tool)
ALTER TABLE qa_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_test_results ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for authenticated users
DROP POLICY IF EXISTS "qa_categories_all" ON qa_categories;
DROP POLICY IF EXISTS "qa_checklist_items_all" ON qa_checklist_items;
DROP POLICY IF EXISTS "qa_test_results_all" ON qa_test_results;

CREATE POLICY "qa_categories_all" ON qa_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "qa_checklist_items_all" ON qa_checklist_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "qa_test_results_all" ON qa_test_results FOR ALL USING (true) WITH CHECK (true);
`;

async function createTables() {
  console.log("Creating QA tables via raw SQL...\n");
  
  // Use fetch to call the Supabase SQL endpoint directly
  const response = await fetch("https://vkpjocnrefjfpuovzinn.supabase.co/rest/v1/rpc/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrcGpvY25yZWZqZnB1b3Z6aW5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIyMTIwNywiZXhwIjoyMDg4Nzk3MjA3fQ.5M-a0_dB0xxx8dHO_X-l8ePcKhyIZ-T38IC85BTcFEo",
      "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrcGpvY25yZWZqZnB1b3Z6aW5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIyMTIwNywiZXhwIjoyMDg4Nzk3MjA3fQ.5M-a0_dB0xxx8dHO_X-l8ePcKhyIZ-T38IC85BTcFEo",
    },
    body: JSON.stringify({ query: createTableSQL }),
  });

  const text = await response.text();
  console.log("Response:", text);
  
  if (!response.ok) {
    console.log("\nDirect SQL didn't work. Please run the migration manually in Supabase Dashboard.");
    console.log("Go to: https://supabase.com/dashboard/project/vkpjocnrefjfpuovzinn/sql/new");
    console.log("Then paste the content of: supabase/migrations/20260321_qa_checklist.sql");
  }
}

createTables().catch(console.error);
