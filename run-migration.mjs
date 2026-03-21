import postgres from "postgres";
import { readFileSync } from "fs";

// Supabase connection - use the pooler for transaction mode
const connectionString = "postgres://postgres.vkpjocnrefjfpuovzinn:bIJ0Eqm5opIsPVpK@aws-0-eu-west-2.pooler.supabase.com:6543/postgres";

// Alternative direct connection
// const connectionString = "postgres://postgres:bIJ0Eqm5opIsPVpK@db.vkpjocnrefjfpuovzinn.supabase.co:5432/postgres";

const sql = postgres(connectionString, {
  ssl: { rejectUnauthorized: false },
});

async function runMigration() {
  console.log("Reading migration file...");
  const migrationSQL = readFileSync("./supabase/migrations/20260321_qa_checklist.sql", "utf8");
  
  // Split into individual statements
  const statements = migrationSQL
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s && !s.startsWith("--"));

  console.log(`Found ${statements.length} SQL statements to execute.\n`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt) continue;
    
    const preview = stmt.substring(0, 80).replace(/\n/g, " ");
    console.log(`[${i + 1}/${statements.length}] ${preview}...`);
    
    try {
      await sql.unsafe(stmt);
      console.log("  ✓ Success");
    } catch (err) {
      console.log(`  ✗ Error: ${err.message}`);
    }
  }

  console.log("\n✅ Migration complete!");
  await sql.end();
}

runMigration().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
