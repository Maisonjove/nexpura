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
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.error("[twilio-whatsapp] Missing Twilio credentials in env");
    return { success: false, error: "Twilio not configured" };
  }

  // Ensure phone number starts with +
  const cleanTo = to.startsWith("+") ? to : `+${to.replace(/\D/g, "")}`;
  const cleanFrom = fromNumber.startsWith("+") ? fromNumber : `+${fromNumber}`;

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
      console.error("[twilio-whatsapp] Send failed:", data);
      return {
        success: false,
        error: data.message || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      messageId: data.sid,
    };
  } catch (err) {
    console.error("[twilio-whatsapp] Error:", err);
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
