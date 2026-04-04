import { redirect } from "next/navigation";

// /register redirects to /signup for backwards compatibility
export default function RegisterPage() {
  redirect("/signup");
}
