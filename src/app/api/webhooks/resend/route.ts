import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import logger from "@/lib/logger";
import crypto from "crypto";

/**
 * Resend Webhook Handler
 * 
 * Handles email delivery events from Resend:
 * - email.delivered — email successfully delivered
 * - email.bounced — email bounced (invalid address)
 * - email.complained — recipient marked as spam
 * 
 * Setup: Configure webhook in Resend dashboard with signing secret
 */

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

interface ResendWebhookEvent {
  type: "email.sent" | "email.delivered" | "email.bounced" | "email.complained" | "email.opened" | "email.clicked";
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    bounce?: {
      message: string;
    };
  };
}

// Verify webhook signature from Resend
function verifySignature(payload: string, signature: string | null): boolean {
  if (!RESEND_WEBHOOK_SECRET || !signature) {
    // If no secret configured, skip verification (dev mode)
    return !RESEND_WEBHOOK_SECRET;
  }
  
  try {
    const [timestamp, signatureHash] = signature.split(",").map(part => {
      const [, value] = part.split("=");
      return value;
    });
    
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac("sha256", RESEND_WEBHOOK_SECRET)
      .update(signedPayload)
      .digest("hex");
    
    return crypto.timingSafeEqual(
      Buffer.from(signatureHash),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("svix-signature");
  
  // Verify signature in production
  if (RESEND_WEBHOOK_SECRET && !verifySignature(body, signature)) {
    logger.warn("[resend-webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    switch (event.type) {
      case "email.bounced": {
        const emails = event.data.to;
        logger.info(`[resend-webhook] Email bounced for: ${emails.join(", ")}`);
        
        // Mark customers with this email as having bounced
        for (const email of emails) {
          // Update customer record
          const { data: customers } = await supabase
            .from("customers")
            .select("id, email_status")
            .ilike("email", email);
          
          if (customers && customers.length > 0) {
            await supabase
              .from("customers")
              .update({ 
                email_status: "bounced",
                email_bounced_at: new Date().toISOString(),
              })
              .in("id", customers.map(c => c.id));
            
            logger.info(`[resend-webhook] Marked ${customers.length} customer(s) as bounced: ${email}`);
          }
          
          // Also update email_logs if we track resend_id
          await supabase
            .from("email_logs")
            .update({ 
              status: "bounced",
              bounce_reason: event.data.bounce?.message || "Email bounced",
            })
            .eq("resend_id", event.data.email_id);
        }
        break;
      }
      
      case "email.complained": {
        const emails = event.data.to;
        logger.info(`[resend-webhook] Spam complaint from: ${emails.join(", ")}`);
        
        // Mark customers as having complained — stop sending them emails
        for (const email of emails) {
          const { data: customers } = await supabase
            .from("customers")
            .select("id")
            .ilike("email", email);
          
          if (customers && customers.length > 0) {
            await supabase
              .from("customers")
              .update({ 
                email_status: "complained",
                email_opted_out: true,
                email_opted_out_at: new Date().toISOString(),
              })
              .in("id", customers.map(c => c.id));
            
            logger.warn(`[resend-webhook] Marked ${customers.length} customer(s) as opted-out due to spam complaint: ${email}`);
          }
        }
        break;
      }
      
      case "email.delivered": {
        // Update email_logs status to delivered
        await supabase
          .from("email_logs")
          .update({ status: "delivered" })
          .eq("resend_id", event.data.email_id);
        break;
      }
      
      default:
        // Ignore other events (sent, opened, clicked)
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("[resend-webhook] Processing error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
