import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Use .nexpura.com in production so cookies are shared across all tenant subdomains.
// Leave NEXT_PUBLIC_COOKIE_DOMAIN unset in development to scope cookies to localhost.
const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined;

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        // Share session cookies across all *.nexpura.com subdomains in production
        domain: cookieDomain,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}
