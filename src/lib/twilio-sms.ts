/**
 * Twilio SMS integration with smart number selection
 * Uses Australian number for AU recipients, US number for international
 */

interface TwilioSmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  smsNumberAU?: string;  // Australian number for domestic
  smsNumberUS?: string;  // US number for international
  phoneNumber?: string;  // Legacy fallback
}

/**
 * Determine if a phone number is Australian
 * Handles various formats: +61, 0061, 61, 04xx, etc.
 */
function isAustralianNumber(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");
  
  // Starts with +61 or 0061
  if (cleaned.startsWith("+61") || cleaned.startsWith("0061")) {
    return true;
  }
  
  // Starts with 61 (without +) and is long enough to be international format
  if (cleaned.startsWith("61") && cleaned.length >= 11) {
    return true;
  }
  
  // Australian mobile starting with 04
  if (cleaned.startsWith("04") && cleaned.length === 10) {
    return true;
  }
  
  // Australian landline starting with 0 (02, 03, 07, 08)
  if (/^0[2378]/.test(cleaned) && cleaned.length === 10) {
    return true;
  }
  
  return false;
}

/**
 * Get the appropriate "From" number based on recipient
 * - Australian recipients: Use AU number (+61...)
 * - International recipients: Use US number (+1...)
 */
function selectFromNumber(
  toNumber: string,
  credentials: TwilioCredentials
): string {
  const auNumber = credentials.smsNumberAU || process.env.TWILIO_SMS_NUMBER_AU;
  const usNumber = credentials.smsNumberUS || process.env.TWILIO_SMS_NUMBER || process.env.TWILIO_WHATSAPP_NUMBER;
  const fallback = credentials.phoneNumber;
  
  if (isAustralianNumber(toNumber)) {
    // Prefer AU number for Australian recipients
    return auNumber || usNumber || fallback || "";
  } else {
    // Use US number for international recipients
    return usNumber || auNumber || fallback || "";
  }
}

/**
 * Normalize phone number to E.164 format
 */
function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  
  // Already has +
  if (cleaned.startsWith("+")) {
    return cleaned;
  }
  
  // Australian mobile starting with 04 → +614
  if (cleaned.startsWith("04") && cleaned.length === 10) {
    return "+61" + cleaned.substring(1);
  }
  
  // Australian landline starting with 0
  if (/^0[2378]/.test(cleaned) && cleaned.length === 10) {
    return "+61" + cleaned.substring(1);
  }
  
  // Starts with 61 (international format without +)
  if (cleaned.startsWith("61") && cleaned.length >= 11) {
    return "+" + cleaned;
  }
  
  // Assume it needs a + prefix
  return "+" + cleaned;
}

/**
 * Send SMS via Twilio with smart number selection
 */
export async function sendTwilioSms(
  to: string,
  message: string,
  credentials?: Partial<TwilioCredentials>
): Promise<TwilioSmsResult> {
  const accountSid = credentials?.accountSid || process.env.TWILIO_ACCOUNT_SID;
  const authToken = credentials?.authToken || process.env.TWILIO_AUTH_TOKEN;
  
  if (!accountSid || !authToken) {
    console.error("[twilio-sms] Missing Twilio credentials");
    return { success: false, error: "Twilio not configured" };
  }

  const fullCredentials: TwilioCredentials = {
    accountSid,
    authToken,
    smsNumberAU: credentials?.smsNumberAU || process.env.TWILIO_SMS_NUMBER_AU,
    smsNumberUS: credentials?.smsNumberUS || process.env.TWILIO_SMS_NUMBER,
    phoneNumber: credentials?.phoneNumber,
  };

  const toNormalized = normalizePhoneNumber(to);
  const fromNumber = selectFromNumber(toNormalized, fullCredentials);

  if (!fromNumber) {
    console.error("[twilio-sms] No from number available");
    return { success: false, error: "No SMS number configured" };
  }

  const fromNormalized = fromNumber.startsWith("+") ? fromNumber : `+${fromNumber}`;

  console.log(`[twilio-sms] Sending to ${toNormalized} from ${fromNormalized} (AU recipient: ${isAustralianNumber(to)})`);

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: toNormalized,
        From: fromNormalized,
        Body: message,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[twilio-sms] Send failed:", data);
      return {
        success: false,
        error: data.message || `HTTP ${response.status}`,
      };
    }

    console.log("[twilio-sms] Message sent:", data.sid);
    return {
      success: true,
      messageId: data.sid,
    };
  } catch (err) {
    console.error("[twilio-sms] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

// Export helper for testing
export { isAustralianNumber, selectFromNumber, normalizePhoneNumber };
