# Nexpura — Production Launch Checklist

> Last updated: March 2026  
> Branch: `annot8/migration-hub`  
> Current frozen build: `https://nexpura-16we67hn9-maisonjoves-projects.vercel.app`

---

## 1. Domain — What the Owner Must Provide

The owner must:

1. **Own the domain `nexpura.com`** and have access to their DNS control panel (Cloudflare, Namecheap, GoDaddy, etc.)
2. **Provide Vercel with the domain** — add via Vercel dashboard or API
3. **Create these DNS records** at their domain registrar:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `76.76.21.21` (Vercel IP) | 3600 |
| CNAME | `www` | `cname.vercel-dns.com` | 3600 |

> If using Cloudflare, proxy (orange cloud) must be **OFF** for the root `@` record.

---

## 2. Vercel Domain Configuration

### Add `nexpura.com` to the Vercel project:

```bash
curl -X POST "https://api.vercel.com/v10/projects/prj_Yt73Y1piQ6uSKDRjam3k4rq8xqFA/domains?teamId=team_fcNkXDRNrMtmZi6uNwCMLelB" \
  -H "Authorization: Bearer <VERCEL_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name": "nexpura.com"}'

curl -X POST "https://api.vercel.com/v10/projects/prj_Yt73Y1piQ6uSKDRjam3k4rq8xqFA/domains?teamId=team_fcNkXDRNrMtmZi6uNwCMLelB" \
  -H "Authorization: Bearer <VERCEL_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name": "www.nexpura.com"}'
```

Vercel will issue an SSL certificate automatically once DNS propagates (usually < 1 hour).

---

## 3. Wildcard Subdomain Support (Future — NOT yet implemented)

> **Current state:** The app uses a **single shared URL** for all tenants. There is no subdomain-per-tenant routing in the middleware.

To add `*.nexpura.com` routing (e.g., `acme.nexpura.com` → Acme Jewellers' dashboard):

### DNS record needed:
| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | `*` | `cname.vercel-dns.com` | 3600 |

### Vercel project — add wildcard domain:
```bash
curl -X POST "https://api.vercel.com/v10/projects/prj_Yt73Y1piQ6uSKDRjam3k4rq8xqFA/domains?teamId=team_fcNkXDRNrMtmZi6uNwCMLelB" \
  -H "Authorization: Bearer <VERCEL_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name": "*.nexpura.com"}'
```

> Note: Vercel Pro plan or higher is required for wildcard domains.

### Code changes required for subdomain routing:
The middleware at `src/lib/supabase/middleware.ts` and `src/proxy.ts` currently has **no subdomain detection**. The following changes would be needed:

1. **`src/proxy.ts`** — extract `host` header, parse subdomain, look up `tenants` table by `slug` = subdomain
2. **`src/lib/supabase/middleware.ts`** — pass resolved `tenant_id` in request headers so Server Components don't need to re-query it
3. **`src/app/(app)/layout.tsx`** — read injected `x-tenant-id` header instead of querying users table
4. **Tenant slug must be set on onboarding** — already done (`tenants.slug` is set in onboarding actions)

**Estimated effort:** 1–2 days of backend work. Not required for initial launch with a single URL.

---

## 4. Required Environment Variables (set in Vercel)

These must be set in the Vercel project settings before launch:

### Critical — App will not work without these:
| Variable | Description | Required in Vercel |
|----------|-------------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ Already set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | ✅ Already set |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) | ✅ Already set |
| `NEXT_PUBLIC_APP_URL` | **Must be set to `https://nexpura.com`** | ❌ Set this now |

> ⚠️ **`NEXT_PUBLIC_APP_URL`** is used in email templates, passport links, billing redirects, and the Xero OAuth callback. Without it, all links in transactional emails will point to `https://nexpura.com` as fallback — which is correct once the domain is live, but **must be set explicitly in Vercel** to avoid any residual `.vercel.app` links.

### Email (transactional emails will silently fail without this):
| Variable | Description | Required |
|----------|-------------|---------|
| `RESEND_API_KEY` | Resend.com API key | ✅ Must be set |

### Stripe (billing will not work without these):
| Variable | Description | Required |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Stripe secret key (sk_live_...) | ✅ Must be set |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (pk_live_...) | ✅ Must be set |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (whsec_...) | ✅ Must be set |
| `STRIPE_PRICE_BASIC_MONTHLY` | Stripe Price ID for Basic monthly | ✅ Must be set |
| `STRIPE_PRICE_BASIC_ANNUAL` | Stripe Price ID for Basic annual | ✅ Must be set |
| `STRIPE_PRICE_PRO_MONTHLY` | Stripe Price ID for Pro monthly | ✅ Must be set |
| `STRIPE_PRICE_PRO_ANNUAL` | Stripe Price ID for Pro annual | ✅ Must be set |
| `STRIPE_PRICE_ULTIMATE_MONTHLY` | Stripe Price ID for Ultimate monthly | ✅ Must be set |
| `STRIPE_PRICE_ULTIMATE_ANNUAL` | Stripe Price ID for Ultimate annual | ✅ Must be set |

### Optional / Feature-gated:
| Variable | Description |
|----------|-------------|
| `XERO_CLIENT_ID` | Xero OAuth app client ID |
| `XERO_CLIENT_SECRET` | Xero OAuth app secret |
| `OPENAI_API_KEY` | For AI Copilot features |

---

## 5. Stripe Setup — Step by Step

1. **Create Stripe account** at stripe.com → switch to **Live mode**
2. **Create 3 products** in Stripe dashboard:
   - Nexpura Basic (add metadata: `plan=basic`)
   - Nexpura Pro (add metadata: `plan=pro`)
   - Nexpura Ultimate (add metadata: `plan=ultimate`)
3. **Create 6 prices** (monthly + annual for each product), note the Price IDs
4. **Set all 6 `STRIPE_PRICE_*` env vars** in Vercel with the real Price IDs
5. **Set up webhook** in Stripe dashboard:
   - Endpoint URL: `https://nexpura.com/api/billing/webhook`
   - Events to listen for: `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`
   - Copy the webhook signing secret → set as `STRIPE_WEBHOOK_SECRET` in Vercel

---

## 6. Supabase — Add Super Admin

To access the platform admin panel at `/admin`:

```sql
-- Run in Supabase SQL editor
INSERT INTO super_admins (user_id)
SELECT id FROM auth.users WHERE email = 'your-admin-email@nexpura.com';
```

The `super_admins` table is already checked in the admin layout — just needs the user's UUID inserted.

---

## 7. Legal Pages

The signup page links to `/terms` and `/privacy`. These routes **do not yet exist** in the codebase. Before launch:
- Create `src/app/(marketing)/terms/page.tsx` with Terms of Service content
- Create `src/app/(marketing)/privacy/page.tsx` with Privacy Policy content

---

## 8. Post-Launch Monitoring

1. Set up **Vercel deployment notifications** (Slack/email) for failed deploys
2. Set up **Supabase monitoring** — enable Database → Logs in Supabase dashboard
3. Monitor **Stripe webhook logs** in Stripe dashboard for any failed deliveries
4. **Resend.com** — verify the sending domain (`nexpura.com`) by adding the required DNS TXT records

### Resend domain verification DNS records:
Log in to Resend → Domains → Add Domain → follow the instructions. Usually requires:
- SPF: TXT record `@ v=spf1 include:amazonses.com ~all`
- DKIM: Multiple CNAME records provided by Resend

---

## 9. Launch Sequence Checklist

- [ ] Domain `nexpura.com` purchased and DNS control accessible
- [ ] DNS A record `@` → `76.76.21.21` created
- [ ] DNS CNAME `www` → `cname.vercel-dns.com` created
- [ ] `nexpura.com` added to Vercel project
- [ ] `NEXT_PUBLIC_APP_URL=https://nexpura.com` set in Vercel
- [ ] `RESEND_API_KEY` set in Vercel
- [ ] Resend sending domain verified for `nexpura.com`
- [ ] Stripe products and prices created (live mode)
- [ ] All 6 `STRIPE_PRICE_*` env vars set in Vercel
- [ ] `STRIPE_SECRET_KEY` (live key) set in Vercel
- [ ] `STRIPE_WEBHOOK_SECRET` set in Vercel
- [ ] Stripe webhook endpoint registered pointing to `https://nexpura.com/api/billing/webhook`
- [ ] Super admin user inserted into `super_admins` table
- [ ] `/terms` and `/privacy` pages created and published
- [ ] Final deploy to production triggered from `main` branch
