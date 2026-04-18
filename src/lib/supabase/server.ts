import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { getCookieDomain, getIsSecure } from "./cookie-config";

export const createClient = cache(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const host = headerStore.get("host") || undefined;
  const proto = headerStore.get("x-forwarded-proto") || undefined;
  const protocol = proto ? `${proto}:` : undefined;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        secure: getIsSecure(protocol, host),
        sameSite: "lax",
        domain: getCookieDomain(host),
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
});
