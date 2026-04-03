#!/usr/bin/env node

/**
 * Apply database migration via Supabase SQL API
 * This uses the postgres-query endpoint which requires the Management API
 * Since we don't have that, this script will use the supabase CLI
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync } from 'fs';

const execAsync = promisify(exec);

const PROJECT_REF = 'vkpjocnrefjfpuovzinn';
const DB_URL = `postgresql://postgres.${PROJECT_REF}:postgres@db.${PROJECT_REF}.supabase.co:5432/postgres`;

// Read migration file
const migrationPath = './supabase/migrations/20260403_tracking_tables.sql';

async function runMigration() {
  console.log('🚀 Applying tracking tables migration...\n');
  
  // Read the SQL file
  let sql;
  try {
    sql = readFileSync(migrationPath, 'utf8');
  } catch (err) {
    console.error('❌ Could not read migration file:', err.message);
    process.exit(1);
  }
  
  console.log('📄 Migration SQL loaded');
  console.log(`   ${sql.split('\n').length} lines`);
  
  // Try using psql if available
  try {
    console.log('\n📡 Attempting to connect via psql...');
    
    // We need the database password - for Supabase it's typically in the project settings
    // For now, output instructions
    console.log('\n⚠️  Direct database access requires the database password.');
    console.log('\n📋 Please run this migration manually:');
    console.log('\n   1. Go to: https://supabase.com/dashboard/project/vkpjocnrefjfpuovzinn/sql/new');
    console.log('   2. Paste the contents of: supabase/migrations/20260403_tracking_tables.sql');
    console.log('   3. Click "Run" to execute the migration');
    console.log('\n   Or use the Supabase CLI:');
    console.log('   supabase db push --db-url "postgresql://postgres:[PASSWORD]@db.vkpjocnrefjfpuovzinn.supabase.co:5432/postgres"');
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

runMigration();
