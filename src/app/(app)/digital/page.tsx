import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import {
  Globe,
  CreditCard,
  Mail,
  MessageSquare,
  RefreshCw,
  Gem,
  Boxes,
  ChevronRight,
  ChevronDown,
  PlugZap,
  ArrowDownToLine,
  Settings,
  ShieldCheck,
  Package,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth-context";
import {
  HubHeader,
  QuickActionTile,
  SectionPanel,
} from "@/components/hub/HubPrimitives";

export const metadata = { title: "Digital — Nexpura" };

/**
 * Digital Hub — Section 10.1 of Kaitlyn's 2026-05-02 redesign brief.
 * cacheComponents requires sync top-level + dynamic body inside Suspense.
 */
export default function DigitalPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full rounded-xl" />}>
      <DigitalHubBody />
    </Suspense>
  );
}

async function DigitalHubBody() {
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
        subtitle="Website, integrations and passports."
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

      {/* Quick actions — flat 4-tile row, no group labels (Brief 2 §4.1) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickActionTile
          label="Website Builder"
          description="Edit pages and layouts."
          href="/website"
          icon={Globe}
        />
        <QuickActionTile
          label="Passports"
          description="Manage digital passports."
          href="/passports"
          icon={Gem}
        />
        <QuickActionTile
          label="Verify Passport"
          description="Look up by ID or QR."
          href="/passports/verify"
          icon={ShieldCheck}
        />
        <QuickActionTile
          label="Integrations"
          description="Connected services."
          href="/integrations"
          icon={PlugZap}
        />
      </div>

      {/* More overflow */}
      <div className="flex justify-end -mt-2">
        <details className="relative">
          <summary className="list-none cursor-pointer inline-flex items-center gap-1 text-[13px] font-medium text-nexpura-charcoal-700 hover:text-nexpura-bronze transition-colors">
            More <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />
          </summary>
          <div className="absolute right-0 mt-2 w-56 rounded-xl border border-nexpura-taupe-100 bg-white shadow-md py-1 z-10">
            <Link href="/website/connect" className="flex items-center gap-2 px-3 py-2 text-[13px] text-nexpura-charcoal-700 hover:bg-nexpura-champagne">
              <PlugZap className="w-4 h-4" strokeWidth={1.5} /> Connect Website
            </Link>
            <Link href="/website" className="flex items-center gap-2 px-3 py-2 text-[13px] text-nexpura-charcoal-700 hover:bg-nexpura-champagne">
              <Settings className="w-4 h-4" strokeWidth={1.5} /> Domain settings
            </Link>
            <Link href="/website" className="flex items-center gap-2 px-3 py-2 text-[13px] text-nexpura-charcoal-700 hover:bg-nexpura-champagne">
              <RefreshCw className="w-4 h-4" strokeWidth={1.5} /> Website sync
            </Link>
            <Link href="/passports/new" className="flex items-center gap-2 px-3 py-2 text-[13px] text-nexpura-charcoal-700 hover:bg-nexpura-champagne">
              <Package className="w-4 h-4" strokeWidth={1.5} /> Issue passport
            </Link>
            <Link href="/migration" className="flex items-center gap-2 px-3 py-2 text-[13px] text-nexpura-charcoal-700 hover:bg-nexpura-champagne">
              <ArrowDownToLine className="w-4 h-4" strokeWidth={1.5} /> Migration Hub
            </Link>
          </div>
        </details>
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
