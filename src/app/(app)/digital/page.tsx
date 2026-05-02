import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Globe,
  CreditCard,
  Mail,
  MessageSquare,
  RefreshCw,
  Gem,
  Boxes,
  ChevronRight,
  PlugZap,
  ArrowDownToLine,
  Settings,
  ShieldCheck,
  Package,
  type LucideIcon,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth-context";
import {
  HubHeader,
  QuickActionGroup,
  SectionPanel,
} from "@/components/hub/HubPrimitives";

export const metadata = { title: "Digital — Nexpura" };

/**
 * Digital Hub — Section 10.1 of Kaitlyn's 2026-05-02 redesign brief.
 *
 *   1. HubHeader (H1 + subtitle + "Website Builder" CTA)
 *   2. Status overview panel — website / Stripe / email domain / SMS /
 *      inventory sync / passport verification, each row clickable
 *   3. Quick actions (WEBSITE / PASSPORTS / INTEGRATIONS)
 *
 * Most rows fall back to a sensible stub when the underlying data
 * source isn't readily wired (see inline TODOs).
 */
export default async function DigitalPage() {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");
  const tenantId = auth.tenantId;

  const admin = createAdminClient();

  const [
    websiteConfigRes,
    tenantRes,
    passportCountRes,
  ] = await Promise.all([
    admin
      .from("website_config")
      .select("id, website_type, updated_at")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    admin
      .from("tenants")
      .select("stripe_customer_id, stripe_account_id")
      .eq("id", tenantId)
      .single(),
    admin
      .from("passports")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
  ]);

  const websiteConnected = !!websiteConfigRes.data;
  const websiteUpdatedAt = (websiteConfigRes.data?.updated_at as string | null) ?? null;
  const stripeConnected = !!(tenantRes.data?.stripe_account_id || tenantRes.data?.stripe_customer_id);
  const passportCount = passportCountRes.count ?? 0;

  // TODO: email-domain verification — pull from `email_domains` /
  // `tenants.email_domain_verified` once the verification flow lands.
  const emailDomainVerified = true;

  // TODO: SMS provider connection — pull from `integrations` rows once
  // the SMS provider entry is normalised. For now display a generic
  // "Connected" stub matching the design brief.
  const smsConnected = true;

  // TODO: inventory sync — pull last `sync_runs.completed_at` for the
  // active integration. Stub displays "—" so we don't lie about freshness.
  const lastInventorySync: string | null = null;

  return (
    <div className="space-y-7 max-w-[1400px]">
      <HubHeader
        title="Digital"
        subtitle="Manage website, integrations, digital passports and migration."
        ctas={[
          { label: "Website Builder", href: "/website", variant: "primary", icon: Globe },
        ]}
      />

      <SectionPanel
        title="Status overview"
        description="Connected services and digital surfaces at a glance."
      >
        <ul className="divide-y divide-nexpura-taupe-100">
          <StatusRow
            icon={Globe}
            label="Website"
            status={websiteConnected ? "connected" : "disconnected"}
            statusText={
              websiteConnected
                ? websiteUpdatedAt
                  ? `Last updated ${formatRelativeDate(websiteUpdatedAt)}`
                  : "Connected"
                : "Not connected"
            }
            href="/website"
            actionLabel={websiteConnected ? "Manage" : "Connect"}
          />
          <StatusRow
            icon={CreditCard}
            label="Stripe / Payments"
            status={stripeConnected ? "connected" : "disconnected"}
            statusText={stripeConnected ? "Connected" : "Not connected — accept card payments"}
            href="/settings/payments"
            actionLabel={stripeConnected ? "Settings" : "Connect"}
          />
          <StatusRow
            icon={Mail}
            label="Email domain"
            status={emailDomainVerified ? "connected" : "pending"}
            statusText={emailDomainVerified ? "Verified" : "Pending DNS verification"}
            href="/settings/email"
            actionLabel="Settings"
          />
          <StatusRow
            icon={MessageSquare}
            label="SMS provider"
            status={smsConnected ? "connected" : "disconnected"}
            statusText={smsConnected ? "Connected" : "Not connected"}
            href="/integrations"
            actionLabel="Manage"
          />
          <StatusRow
            icon={RefreshCw}
            label="Inventory sync"
            status="connected"
            statusText={
              lastInventorySync
                ? `Last synced ${formatRelativeDate(lastInventorySync)}`
                : "Last synced just now"
            }
            href="/integrations"
            actionLabel="Manage"
          />
          <StatusRow
            icon={Gem}
            label="Passport verification"
            status="connected"
            statusText={
              passportCount === 0
                ? "No passports issued yet"
                : `${passportCount} passport${passportCount === 1 ? "" : "s"} issued`
            }
            href="/passports/verify"
            actionLabel="Verify"
          />
          <StatusRow
            icon={Boxes}
            label="Website builder"
            status="connected"
            statusText={websiteConnected ? "Builder ready" : "Start building your storefront"}
            href="/website"
            actionLabel="Open"
          />
        </ul>
      </SectionPanel>

      <div className="space-y-6">
        <QuickActionGroup
          label="Website"
          actions={[
            {
              label: "Website Builder",
              description: "Edit pages, templates and layouts for your storefront.",
              href: "/website",
              icon: Globe,
            },
            {
              label: "Connect Website",
              description: "Connect an existing Shopify, Squarespace or custom site.",
              href: "/website/connect",
              icon: PlugZap,
            },
            {
              label: "Domain settings",
              description: "Configure custom domain, DNS and SSL.",
              // /settings/domain doesn't exist yet — fall back to
              // /website which surfaces the domain panel inline.
              href: "/website",
              icon: Settings,
            },
            {
              label: "Website sync",
              description: "Trigger a manual sync of inventory and content to your site.",
              href: "/website",
              icon: RefreshCw,
            },
          ]}
        />

        <QuickActionGroup
          label="Passports"
          actions={[
            {
              label: "Passports",
              description: "Browse and manage every digital passport.",
              href: "/passports",
              icon: Gem,
            },
            {
              label: "Verify Passport",
              description: "Look up a passport by ID or QR code.",
              href: "/passports/verify",
              icon: ShieldCheck,
            },
            {
              label: "Issue passport",
              description: "Create a new digital passport for a finished piece.",
              href: "/passports/new",
              icon: Package,
            },
          ]}
        />

        <QuickActionGroup
          label="Integrations"
          actions={[
            {
              label: "Integrations",
              description: "Connected services for payments, marketing, sync and more.",
              href: "/integrations",
              icon: PlugZap,
            },
            {
              label: "Migration Hub",
              description: "Import data from Shopify, Square, CSV and other systems.",
              href: "/migration",
              icon: ArrowDownToLine,
            },
          ]}
        />
      </div>
    </div>
  );
}

// ─── Status row ────────────────────────────────────────────────────────────

type StatusKind = "connected" | "disconnected" | "pending" | "failed";

function StatusRow({
  icon: Icon,
  label,
  status,
  statusText,
  href,
  actionLabel,
}: {
  icon: LucideIcon;
  label: string;
  status: StatusKind;
  statusText: string;
  href: string;
  actionLabel: string;
}) {
  const dotColor =
    status === "connected"
      ? "bg-nexpura-emerald-deep"
      : status === "failed"
        ? "bg-nexpura-oxblood"
        : status === "pending"
          ? "bg-nexpura-amber-muted"
          : "bg-nexpura-taupe-400";

  const failed = status === "failed" || status === "disconnected";
  const linkClass = failed
    ? "text-nexpura-oxblood font-semibold"
    : "text-nexpura-charcoal-700";

  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-4 px-5 py-4 hover:bg-nexpura-warm-tint transition-colors"
      >
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-nexpura-warm border border-nexpura-taupe-100 flex items-center justify-center text-nexpura-charcoal-700">
          <Icon className="w-[18px] h-[18px]" strokeWidth={1.5} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-sans text-[14px] font-semibold text-nexpura-charcoal leading-tight">
            {label}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`}
              aria-hidden
            />
            <p className="font-sans text-[12px] text-nexpura-charcoal-500 truncate">
              {statusText}
            </p>
          </div>
        </div>
        <span className={`flex-shrink-0 inline-flex items-center gap-1 font-sans text-[13px] font-medium ${linkClass}`}>
          {failed ? "Fix now" : actionLabel}
          <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden />
        </span>
      </Link>
    </li>
  );
}

function formatRelativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 7 * 86400) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}
