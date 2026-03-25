import { redirect } from "next/navigation";

// Redirect /auth/sign-up → /signup
export default function SignUpRedirect() {
  redirect("/signup");
}
