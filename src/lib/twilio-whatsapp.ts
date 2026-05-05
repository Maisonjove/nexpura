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
 * Cleanup #30: best-effort E.164 normalization for caller-supplied
 * phone numbers before they hit Twilio.
 *
 * Twilio's WhatsApp send rejects non-E.164 input with a 400 + Twilio
 * code 21211 ("Invalid 'To' Phone Number"), and the upstream call sites
 * (manual operator entry, CSV imports, customer profile fields)
 * historically passed the number raw — "0412 345 678", "(02) 9876
 * 5432", "+61 412 345 678", etc.
 *
 * Behaviour:
 *   - Strips spaces, dashes, parens, dots
 *   - "+61 412 345 678"  → "+61412345678"
 *   - "0061412345678"    → "+61412345678"  (00 prefix → "+")
 *   - "0412 345 678"     → "+61412345678"  (leading 0 + AU default)
 *   - "61412345678"      → "+61412345678"  (already country-coded, no +)
 *   - Any input that ends up <8 or >15 digits → null
 *
 * Returns null on un-normalizable input — the caller decides whether
 * to throw, skip, or surface a UI error. The Twilio send path throws
 * a clear "Invalid phone format: <input>" error in that branch so the
 * surrounding catch (and Sentry breadcrumb) names the offending value
 * instead of the opaque Twilio 21211.
 *
 * Default country: AU (+61). Maison Jove + Nexpura's launch market.
 */
const COUNTRY_CODES: Record<"AU", string> = {
  AU: "61",
};

export function toE164(
  phone: string | null | undefined,
  defaultCountry: "AU" = "AU",
): string | null {
  if (!phone) return null;
  const trimmed = String(phone).trim();
  if (!trimmed) return null;

  // Strip everything that's not a digit or a leading "+".
  const stripped = trimmed.replace(/[\s\-().·]/g, "");
  if (!stripped) return null;

  let digits: string;
  if (stripped.startsWith("+")) {
    digits = stripped.slice(1).replace(/\D/g, "");
  } else if (stripped.startsWith("00")) {
    // International "00" prefix → swap for "+".
    digits = stripped.slice(2).replace(/\D/g, "");
  } else if (stripped.startsWith("0")) {
    // Trunk prefix → drop and apply default country code.
    const local = stripped.slice(1).replace(/\D/g, "");
    digits = `${COUNTRY_CODES[defaultCountry]}${local}`;
  } else {
    const onlyDigits = stripped.replace(/\D/g, "");
    if (!onlyDigits) return null;
    // Heuristic: if the input already starts with the configured
    // country code (e.g., "61412345678"), trust it. Otherwise it's a
    // bare local subscriber number — prefix the default country.
    if (onlyDigits.startsWith(COUNTRY_CODES[defaultCountry])) {
      digits = onlyDigits;
    } else {
      digits = `${COUNTRY_CODES[defaultCountry]}${onlyDigits}`;
    }
  }

  if (digits.length < 8 || digits.length > 15) return null;
  if (!/^\d+$/.test(digits)) return null;
  return `+${digits}`;
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

  // Cleanup #30: hard-normalize to E.164 before handing the number to
  // Twilio. Pre-fix this just stuck a "+" on the front if the digits
  // weren't already prefixed, which let "0412 345 678" through as
  // "+0412345678" and Twilio bounced it with 21211. Throw a clear
  // diagnostic — caller's catch block surfaces the actual offending
  // input to ops instead of the opaque Twilio code.
  const cleanTo = toE164(to);
  if (!cleanTo) {
    throw new Error(`Invalid phone format: ${to}`);
  }

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
