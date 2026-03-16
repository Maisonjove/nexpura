import { redirect } from "next/navigation";

export default function CampaignsPage() {
  // Campaigns not yet available — redirect to customers
  redirect("/customers");
}
