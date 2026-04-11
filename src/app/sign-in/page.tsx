import { redirect } from "next/navigation";

// Redirect /sign-in → /login
// (The canonical login route is /login. /auth/sign-in also redirects there,
// but /sign-in itself 404'd. This fixes that.)
export default function SignInRedirect() {
  redirect("/login");
}
