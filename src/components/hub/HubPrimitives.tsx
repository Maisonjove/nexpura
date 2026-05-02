/**
 * Shared hub primitives — Section 4 of Kaitlyn's 2026-05-02 workspace
 * redesign brief. The four module hubs (Sales, Customers, Marketing, Admin)
 * all share:
 *
 *   - HubHeader        — H1 + subtitle + right-aligned CTAs
 *   - KpiCard          — 1 of 5–6 cards in the strip; ghost-clickable, lifts on hover
 *   - QuickActionGroup — section label ("TRANSACT" / "MANAGE" / etc.) above a 3-col grid
 *   - QuickActionTile  — Lucide icon + title + description + chevron
 *   - SectionPanel     — wrapper for the module-specific panel below the quick actions
 *
 * Tokens come from the `nexpura.*` Tailwind namespace; no raw hex.
 *
 * Server-renderable: no client-only hooks. The chevron-on-hover animates
 * via CSS group-hover, so no JS state is needed. Keeping this file as a
 * server component is required so the Lucide `icon: LucideIcon` props on
 * HubHeader/QuickActionTile can be passed straight from server pages
 * (Customers/Workshop/Digital). If this were "use client", those icon
 * function-component props would fail to serialize across the server →
 * client boundary at render time and the whole hub page would error.
 */

import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// ─── Header ────────────────────────────────────────────────────────────────

export type HubCta = {
  label: string;
  href: string;
  /**
   * primary  — charcoal, white text (use for the most-likely action)
   * bronze   — bronze, white text (use for an alt high-intent action, e.g. POS)
   * secondary — ivory-elevated card chip
   */
  variant?: "primary" | "bronze" | "secondary";
  icon?: LucideIcon;
};

function ctaClasses(variant: HubCta["variant"] = "primary"): string {
  if (variant === "bronze") {
    return "bg-nexpura-bronze text-white hover:bg-nexpura-bronze-hover";
  }
  if (variant === "secondary") {
    return "bg-nexpura-ivory-elevated border border-nexpura-taupe-100 text-nexpura-charcoal hover:bg-nexpura-champagne hover:border-nexpura-taupe-200";
  }
  return "bg-nexpura-charcoal text-white hover:bg-nexpura-charcoal-700";
}

export function HubHeader({
  title,
  subtitle,
  ctas,
}: {
  title: string;
  subtitle: string;
  ctas?: HubCta[];
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-serif text-[32px] md:text-[26px] font-medium tracking-[-0.01em] text-nexpura-charcoal leading-tight">
          {title}
        </h1>
        <p className="font-sans text-[14px] text-nexpura-charcoal-500 mt-1.5 leading-relaxed">
          {subtitle}
        </p>
      </div>
      {ctas && ctas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 md:flex-shrink-0">
          {ctas.map((cta) => {
            const Icon = cta.icon;
            return (
              <Link
                key={cta.href + cta.label}
                href={cta.href}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${ctaClasses(cta.variant)}`}
              >
                {Icon && <Icon className="w-4 h-4" strokeWidth={1.5} aria-hidden />}
                {cta.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── KPI strip ────────────────────────────────────────────────────────────

export type KpiTone = "neutral" | "danger" | "warn" | "success";

export type KpiCardProps = {
  label: string;
  value: string | number;
  href?: string;
  tone?: KpiTone;
  /** Optional small caption under the big number. */
  hint?: string;
};

export function KpiCard({ label, value, href, tone = "neutral", hint }: KpiCardProps) {
  // Number colour mirrors the dashboard convention. Zero values keep the
  // muted taupe — KPIs that aren't a real "0" (e.g. currency) should pass a
  // string so we don't erase emphasis.
  const numericZero = typeof value === "number" && value === 0;
  const numberColor = numericZero
    ? "text-nexpura-taupe-400"
    : tone === "danger"
      ? "text-nexpura-oxblood"
      : tone === "warn"
        ? "text-nexpura-amber-muted"
        : tone === "success"
          ? "text-nexpura-emerald-deep"
          : "text-nexpura-charcoal";

  const borderColor = numericZero
    ? "border-nexpura-taupe-100"
    : tone === "danger"
      ? "border-nexpura-oxblood-bg"
      : tone === "warn"
        ? "border-nexpura-amber-bg"
        : tone === "success"
          ? "border-nexpura-emerald-bg"
          : "border-nexpura-taupe-100";

  const Inner = (
    <div className="min-w-0">
      <p
        className="font-sans text-[11px] font-semibold tracking-[0.12em] uppercase text-nexpura-taupe-400 break-words leading-tight"
        title={label}
      >
        {label}
      </p>
      <p
        className={`font-sans text-[24px] font-medium tracking-[-0.01em] tabular-nums leading-none mt-2 ${numberColor}`}
      >
        {value}
      </p>
      {hint && (
        <p className="font-sans text-[12px] text-nexpura-charcoal-500 mt-1.5 truncate">
          {hint}
        </p>
      )}
    </div>
  );

  const baseClasses = `block bg-nexpura-ivory-elevated rounded-xl px-4 py-3.5 border ${borderColor} transition-all duration-200`;

  if (href) {
    return (
      <Link
        href={href}
        className={`${baseClasses} hover:border-nexpura-taupe-200 hover:shadow-md`}
      >
        {Inner}
      </Link>
    );
  }
  return <div className={baseClasses}>{Inner}</div>;
}

export function KpiStrip({ children }: { children: ReactNode }) {
  return (
    <section aria-label="Key performance indicators">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {children}
      </div>
    </section>
  );
}

// ─── Quick actions ─────────────────────────────────────────────────────────

export type QuickAction = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-sans text-[11px] font-semibold tracking-[0.12em] uppercase text-nexpura-taupe-400 mb-3">
      {children}
    </h2>
  );
}

export function QuickActionTile({ label, description, href, icon: Icon }: QuickAction) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 p-4 rounded-xl bg-nexpura-ivory-elevated border border-nexpura-taupe-100 hover:border-nexpura-taupe-200 hover:shadow-md hover:bg-nexpura-champagne/30 transition-all duration-200"
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-nexpura-warm border border-nexpura-taupe-100 flex items-center justify-center text-nexpura-charcoal-700">
        <Icon className="w-[18px] h-[18px]" strokeWidth={1.5} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-sans text-[14px] font-semibold text-nexpura-charcoal leading-tight">
          {label}
        </p>
        <p className="font-sans text-[12px] text-nexpura-charcoal-500 mt-1 leading-relaxed">
          {description}
        </p>
      </div>
      <ChevronRight
        className="flex-shrink-0 w-4 h-4 mt-0.5 text-nexpura-taupe-400 group-hover:translate-x-0.5 group-hover:text-nexpura-charcoal-700 transition-all duration-200"
        strokeWidth={1.5}
        aria-hidden
      />
    </Link>
  );
}

export function QuickActionGroup({
  label,
  actions,
}: {
  label: string;
  actions: QuickAction[];
}) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {actions.map((a) => (
          <QuickActionTile key={a.href + a.label} {...a} />
        ))}
      </div>
    </div>
  );
}

// ─── Section panel ────────────────────────────────────────────────────────

export function SectionPanel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
  children: ReactNode;
}) {
  return (
    <section className="bg-nexpura-ivory-elevated border border-nexpura-taupe-100 rounded-xl">
      <div className="px-5 py-4 border-b border-nexpura-taupe-100 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-sans text-[16px] font-semibold text-nexpura-charcoal leading-tight">
            {title}
          </h2>
          {description && (
            <p className="font-sans text-[13px] text-nexpura-charcoal-500 mt-0.5 leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {action && (
          <Link
            href={action.href}
            className="flex-shrink-0 inline-flex items-center gap-1 font-sans text-[13px] font-medium text-nexpura-charcoal-700 hover:text-nexpura-charcoal transition-colors"
          >
            {action.label}
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

// ─── Multi-CTA empty state (extends EmptyState pattern) ───────────────────

export function HubEmptyState({
  icon: Icon,
  title,
  description,
  ctas,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  ctas?: HubCta[];
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      {Icon && (
        <div className="w-12 h-12 rounded-xl bg-nexpura-warm border border-nexpura-taupe-100 flex items-center justify-center mb-4 text-nexpura-taupe-400">
          <Icon className="w-5 h-5" strokeWidth={1.5} aria-hidden />
        </div>
      )}
      <h3 className="font-sans text-[16px] font-semibold text-nexpura-charcoal mb-1.5">
        {title}
      </h3>
      {description && (
        <p className="font-sans text-[13px] text-nexpura-charcoal-500 max-w-md leading-relaxed">
          {description}
        </p>
      )}
      {ctas && ctas.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          {ctas.map((cta) => {
            const Icon2 = cta.icon;
            return (
              <Link
                key={cta.href + cta.label}
                href={cta.href}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${ctaClasses(cta.variant)}`}
              >
                {Icon2 && <Icon2 className="w-4 h-4" strokeWidth={1.5} aria-hidden />}
                {cta.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
