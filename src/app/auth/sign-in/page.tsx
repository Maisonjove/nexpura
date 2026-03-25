import { redirect } from "next/navigation";

// Redirect /auth/sign-in → /login
export default function SignInRedirect() {
  redirect("/login");
}
