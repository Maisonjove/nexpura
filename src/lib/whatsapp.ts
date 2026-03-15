/**
 * Server-side WhatsApp sender — call directly from server actions.
 * Does NOT go through the HTTP route (no auth cookie needed).
 */

import { getIntegration } from "@/lib/integrations";

export async function sendWhatsAppMessage(
  tenantId: string,
  to: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const integration = await getIntegration(tenantId, "whatsapp");
    if (!integration || integration.status !== "connected") {
      return { success: false, error: "WhatsApp not connected" };
    }

    const cfg = integration.config as Record<string, unknown>;
    const phoneNumberId = cfg.phone_number_id as string;
    const accessToken = cfg.access_token as string;

    if (!phoneNumberId || !accessToken) {
      return { success: false, error: "Incomplete WhatsApp credentials" };
    }

    const normalised = to.replace(/\D/g, "");

    const res = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: normalised,
          type: "text",
          text: { body: message },
        }),
      }
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = (errData as any)?.error?.message ?? `HTTP ${res.status}`;
      return { success: false, error: msg };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "unknown" };
  }
}
