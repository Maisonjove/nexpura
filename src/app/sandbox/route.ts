/**
 * /sandbox — Server-side demo sandbox entry point
 *
 * Establishes a real Supabase auth session for the seeded Marcus & Co. demo tenant
 * entirely on the server, then redirects the reviewer directly into the real app.
 *
 * No client-side JS required. No login form. No spinner.
 * Session cookies are set on the redirect response before the browser ever renders.
 *
 * PREVIEW-ONLY: Hard-wired to demo tenant. Does not affect production.
 */

import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Build the redirect response first — cookies will be attached to it
  const response = NextResponse.redirect(new URL("/", request.url));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read incoming cookies from the request
        getAll() {
          return request.cookies.getAll();
        },
        // Write session cookies onto the outgoing redirect response
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({
    email: "demo@nexpura.com",
    password: "nexpura-demo-2026",
  });

  if (error) {
    return new Response(
      `Demo sandbox auth failed: ${error.message}\n\nTry refreshing or contact the team.`,
      { status: 500, headers: { "Content-Type": "text/plain" } }
    );
  }

  // Session cookies are now set on the response.
  // Browser will receive 302 → / with Set-Cookie headers.
  // Middleware will validate the session on the next request.
  return response;
}
