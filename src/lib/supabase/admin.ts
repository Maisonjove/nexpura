import { createClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client using service role key.
 * NEVER import this in client components — server-only.
 * Bypasses RLS to see all tenant data.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
