import logger from "@/lib/logger";
import { isSandbox, logSandboxSuppressedSend } from "@/lib/sandbox";
/**
 * Twilio WhatsApp API integration for sending notifications
 * Uses Twilio's REST API directly (no npm package needed)
 */

interface TwilioWhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a WhatsApp message via Twilio
 * @param to Phone number with country code (e.g., "+1234567890")
 * @param message Text message to send
 */
export async function sendTwilioWhatsApp(
  to: string,
  message: string
): Promise<TwilioWhatsAppResult> {
  // Sandbox gate — see src/lib/sandbox.ts. Preview/dev/SANDBOX_MODE
  // never hits real WhatsApp numbers. The marketing-campaign flow sends
  // in a batch after payment, which makes a live sandbox slip-up
  // especially expensive, so this is the most important guard of the
  // three senders.
  if (isSandbox()) {
    logSandboxSuppressedSend({ channel: "whatsapp", to, preview: message });
    return { success: true, messageId: "sandbox-suppressed" };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    logger.error("[twilio-whatsapp] Missing Twilio credentials in env");
    return { success: false, error: "Twilio not configured" };
  }

  // Ensure phone number starts with +
  const cleanTo = to.startsWith("+") ? to : `+${to.replace(/\D/g, "")}`;

  // Defensive: tolerate TWILIO_WHATSAPP_NUMBER being set with or without
  // a leading `whatsapp:` prefix. Pre-fix, an env value of
  // "whatsapp:+1234567890" produced twilioFrom="whatsapp:+whatsapp:+1234567890"
  // which Twilio rejects with 63007 ("no Channel with this From address")
  // and the error is invisible from the env screen alone.
  const fromStripped = fromNumber.replace(/^whatsapp:/i, "").trim();
  const cleanFrom = fromStripped.startsWith("+") ? fromStripped : `+${fromStripped}`;

  // Twilio WhatsApp format: whatsapp:+number
  const twilioTo = `whatsapp:${cleanTo}`;
  const twilioFrom = `whatsapp:${cleanFrom}`;

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: twilioTo,
        From: twilioFrom,
        Body: message,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error("[twilio-whatsapp] Send failed", {
        twilioCode: data.code,
        twilioMessage: data.message,
        moreInfo: data.more_info,
        httpStatus: response.status,
        from: twilioFrom,
      });
      // Bake the Twilio numeric code into the persisted error so ops
      // can grep without tailing logs. 63007 in particular is the
      // "From channel not configured" signal — by far the most common
      // 'why didn't WhatsApp arrive?' cause and the one that needs a
      // dashboard fix, not a code fix.
      const baseMessage = data.message || `HTTP ${response.status}`;
      return {
        success: false,
        error: data.code ? `[${data.code}] ${baseMessage}` : baseMessage,
      };
    }

    return {
      success: true,
      messageId: data.sid,
    };
  } catch (err) {
    logger.error("[twilio-whatsapp] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/**
 * Send a task assignment notification via Twilio WhatsApp
 */
export async function sendTaskNotification(
  to: string,
  task: {
    description: string;
    customerName?: string;
    type?: "repair" | "bespoke" | "task";
  }
): Promise<TwilioWhatsAppResult> {
  const typeLabel = task.type === "repair" 
    ? "repair" 
    : task.type === "bespoke" 
    ? "bespoke job" 
    : "task";

  let message = `🔔 New ${typeLabel} assigned: ${task.description}`;
  
  if (task.customerName) {
    message += ` - ${task.customerName}`;
  }

  return sendTwilioWhatsApp(to, message);
}
