import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const OWNER_EMAIL = "germanijoey@yahoo.com";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  const pathname = request.nextUrl.pathname;

  // Owner Admin Portal Protection
  if (pathname.startsWith("/owner-admin")) {
    // Allow access to the login page
    if (pathname === "/owner-admin") {
      // If already logged in as owner, redirect to dashboard
      if (session?.user?.email === OWNER_EMAIL) {
        return NextResponse.redirect(new URL("/owner-admin/dashboard", request.url));
      }
      return response;
    }

    // All other owner-admin routes require owner authentication
    if (!session) {
      return NextResponse.redirect(new URL("/owner-admin", request.url));
    }

    if (session.user.email !== OWNER_EMAIL) {
      // Sign them out and redirect to owner login
      return NextResponse.redirect(new URL("/owner-admin", request.url));
    }
  }

  // Old memberships page - redirect to owner admin
  if (pathname === "/memberships") {
    if (session?.user?.email === OWNER_EMAIL) {
      return NextResponse.redirect(new URL("/owner-admin/memberships", request.url));
    }
    // Non-owners get redirected to dashboard
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/owner-admin/:path*",
    "/memberships",
  ],
};
