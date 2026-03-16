import { redirect } from "next/navigation";

export default function AutomationPage() {
  // Automation not yet available — redirect to customers
  redirect("/customers");
}
