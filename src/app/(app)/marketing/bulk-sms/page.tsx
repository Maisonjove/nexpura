import { redirect } from "next/navigation";

export const metadata = { title: "Bulk SMS — Nexpura" };

// Redirect to WhatsApp campaigns - SMS is now WhatsApp-based
export default function BulkSMSPage() {
  redirect("/marketing/whatsapp-campaigns");
}
