# Nexpura — Integrations Setup Guide

This document covers how to configure each external integration available in Nexpura.

---

## 1. Stripe Connect

Nexpura uses **Stripe Connect** to process payments on behalf of your jewellery business. This allows customers to pay invoices online, and funds flow directly to your bank account.

### Required Environment Variables

```env
STRIPE_SECRET_KEY=sk_live_...          # Your Stripe secret key (live)
STRIPE_PUBLISHABLE_KEY=pk_live_...     # Your Stripe publishable key
STRIPE_WEBHOOK_SECRET=whsec_...        # Webhook signing secret
NEXT_PUBLIC_STRIPE_KEY=pk_live_...     # Public key for client-side
```

### Setup Steps

1. **Create a Stripe account** at [stripe.com](https://stripe.com) if you don't have one
2. Go to **Developers → API Keys** and copy your live keys
3. Add the keys to your Vercel environment variables (Settings → Environment Variables)
4. Set up a **webhook endpoint** at `https://yourdomain.com/api/webhooks/stripe`
   - Events to listen for: `payment_intent.succeeded`, `payment_intent.payment_failed`, `invoice.paid`
5. Copy the webhook signing secret and add it as `STRIPE_WEBHOOK_SECRET`
6. In Nexpura, go to **Settings → Payments** to complete Stripe Connect onboarding

### Test Mode

For development/staging, use test keys (`sk_test_...`). Test card: `4242 4242 4242 4242`

---

## 2. WhatsApp Business API (via Twilio or Meta Direct)

Nexpura supports WhatsApp notifications for repair ready, appointment reminders, payment receipts, and marketing campaigns.

### Option A: Twilio (Recommended for most businesses)

#### Required Environment Variables

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886   # Your Twilio WhatsApp number
```

#### Setup Steps

1. Sign up at [twilio.com](https://twilio.com)
2. Enable **WhatsApp Sandbox** (or apply for a production number)
3. Go to **Messaging → Senders → WhatsApp Senders** → create a sender
4. Copy your Account SID and Auth Token from the Twilio Console Dashboard
5. Add environment variables to Vercel
6. In Nexpura, go to **Settings → Notifications → WhatsApp** and enter your Twilio number

#### WhatsApp Message Templates

Pre-approved message templates are required for outbound notifications. Nexpura includes these default templates:
- `repair_ready` — "Your repair REP-{number} is ready for collection."
- `appointment_reminder` — "Reminder: You have an appointment at {business} on {date}."
- `payment_receipt` — "Payment of {amount} received. Thank you!"

### Option B: Meta Business API (Direct)

For higher volume businesses wanting direct Meta integration:

1. Create a **Meta for Developers** account
2. Set up a **WhatsApp Business Platform** app
3. Required env vars:
```env
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_permanent_access_token
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_random_verify_token
```

---

## 3. Google Calendar OAuth

Nexpura can sync appointments to your team's Google Calendar — useful for scheduling bespoke consultations and appointment reminders.

### Required Environment Variables

```env
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/integrations/google-calendar/callback
```

### Setup Steps

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the **Google Calendar API**
4. Go to **OAuth consent screen** → configure as External
5. Go to **Credentials → Create Credentials → OAuth Client ID**
   - Application type: **Web application**
   - Authorised redirect URI: `https://yourdomain.com/api/integrations/google-calendar/callback`
6. Copy Client ID and Client Secret
7. Add to Vercel environment variables
8. In Nexpura, go to **Integrations → Google Calendar** and click **Connect**

### Required OAuth Scopes

```
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/calendar.readonly
```

---

## 4. Shopify Integration

Sync Nexpura inventory with your Shopify online store. Products created or updated in Nexpura can be pushed to Shopify, and Shopify orders can flow into Nexpura sales.

### Required Environment Variables

```env
SHOPIFY_STORE_URL=yourstore.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxx
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret
```

### Setup Steps

1. In your Shopify admin, go to **Settings → Apps and sales channels → Develop apps**
2. Create a new custom app with these permissions:
   - `read_products`, `write_products`
   - `read_orders`, `write_orders`
   - `read_inventory`, `write_inventory`
3. Install the app and copy the Admin API access token
4. Set up webhooks in Shopify for: `orders/create`, `products/update`
5. Add environment variables to Vercel
6. In Nexpura, go to **Integrations → Shopify** and enter your store URL

---

## 5. WooCommerce Integration

For WordPress-based online stores using WooCommerce.

### Required Environment Variables

```env
WOOCOMMERCE_STORE_URL=https://yourstore.com
WOOCOMMERCE_CONSUMER_KEY=ck_xxxxxxxxxxxxx
WOOCOMMERCE_CONSUMER_SECRET=cs_xxxxxxxxxxxxx
```

### Setup Steps

1. In WordPress, go to **WooCommerce → Settings → Advanced → REST API**
2. Click **Add Key** → set permissions to **Read/Write**
3. Copy the Consumer Key and Consumer Secret
4. Add environment variables to Vercel
5. Configure webhooks in WooCommerce:
   - Topic: Order Created → Delivery URL: `https://yourdomain.com/api/webhooks/woocommerce`
6. In Nexpura, go to **Integrations → WooCommerce** to complete setup

---

## 6. Xero Accounting

Connect Nexpura to Xero to automatically sync sales, invoices, expenses, and payments.

### Required Environment Variables

```env
XERO_CLIENT_ID=your_client_id
XERO_CLIENT_SECRET=your_client_secret
XERO_REDIRECT_URI=https://yourdomain.com/api/integrations/xero/callback
```

### Setup Steps

1. Create a **Xero Developer** account at [developer.xero.com](https://developer.xero.com)
2. Create a new app with **OAuth 2.0** authentication
3. Set the redirect URI: `https://yourdomain.com/api/integrations/xero/callback`
4. Copy Client ID and Client Secret
5. In Nexpura, go to **Integrations → Xero** and click **Connect to Xero**
6. Authorise Nexpura access to your Xero organisation

---

## 7. Insurance Integration

Generate insurance-ready appraisal reports compliant with industry standards.

### Configuration (in Nexpura)

No external credentials required. Configuration is done within Nexpura:

1. Go to **Settings → Appraisals**
2. Enter:
   - Appraiser name and qualifications
   - Certification body and membership number
   - Default valuation method (replacement cost, market value)
3. Enable insurance appraisal export in **Integrations → Insurance**

---

## Testing Integrations

All integrations support a test mode. Use the environment suffix `_TEST` for test keys:

```bash
# Verify all integrations status
curl -H "Authorization: Bearer <token>" https://yourdomain.com/api/integrations/status
```

Expected response:
```json
{
  "stripe": { "status": "connected", "configured": true },
  "whatsapp": { "status": "connected" },
  "google_calendar": { "status": "connected" },
  "shopify": { "status": "disconnected" },
  "xero": { "status": "connected", "org_name": "Your Org" }
}
```

---

## Support

For integration support, contact: integrations@nexpura.com  
Documentation: https://docs.nexpura.com/integrations
