"use client";

/**
 * Sales Hub — Section 5 of Kaitlyn's 2026-05-02 redesign brief.
 *
 * Wraps the existing <SalesListClient /> in a hub shell:
 *   1. Page header (H1 + subtitle + CTAs)
 *   2. KPI strip (6 cards)
 *   3. Quick actions (TRANSACT / MANAGE / ADDITIONAL)
 *   4. Recent sales panel — capped to 8 rows, links to /sales for the full list
 *   5. Empty state when no sales exist
 *
 * Data flow is preserved: the server passes the existing `getSales(null)`
 * result through and a separate KPI bundle is computed on the server.
 */

import Link from "next/link";
import { ShoppingBag, Zap, FilePlus, FileText, Search, FileCheck, Calendar, Undo2, Gift, PiggyBank, Receipt, ChevronDown } from "lucide-react";
import {
  HubHeader,
  KpiCard,
  KpiStrip,
  QuickActionTile,
  SectionPanel,
  HubEmptyState,
} from "@/components/hub/HubPrimitives";
import SalesListClient from "./SalesListClient";
import type { SaleWithLocation } from "./sales-actions";

interface SalesKpis {
  salesToday: number;
  salesThisMonth: number;
  outstandingInvoices: number;
  openQuotes: number;
  activeLaybys: number;
}

interface Props {
  initialSales: SaleWithLocation[];
  kpis: SalesKpis;
}

function fmtCurrency(amount: number): string {
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${Math.round(amount).toLocaleString()}`;
  }
}

export default function SalesHubClient({ initialSales, kpis }: Props) {
  const hasSales = initialSales.length > 0;

  return (
    <div className="space-y-7 max-w-[1400px]">
      <HubHeader
        title="Sales"
        subtitle="Track POS, invoices, quotes and laybys."
        ctas={[
          { label: "New Sale", href: "/sales/new", variant: "primary", icon: FilePlus },
        ]}
      />

      {/* KPI strip — 5 cards (AOV dropped per Brief 2 §4.1) */}
      <KpiStrip>
        <KpiCard
          label="Sales today"
          value={fmtCurrency(kpis.salesToday)}
          tone="neutral"
          href="/sales?range=today"
        />
        <KpiCard
          label="Sales this month"
          value={fmtCurrency(kpis.salesThisMonth)}
          tone="neutral"
          href="/sales?range=month"
        />
        <KpiCard
          label="Outstanding invoices"
          value={fmtCurrency(kpis.outstandingInvoices)}
          tone={kpis.outstandingInvoices > 0 ? "warn" : "neutral"}
          href="/invoices?status=overdue"
        />
        <KpiCard
          label="Open quotes"
          value={kpis.openQuotes}
          tone="neutral"
          href="/quotes"
        />
        <KpiCard
          label="Active laybys"
          value={kpis.activeLaybys}
          tone="neutral"
          href="/laybys"
        />
      </KpiStrip>

      {/* Quick actions — flat 4-tile row, no group labels (Brief 2 §4.1) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickActionTile
          label="New sale"
          description="Record a counter sale."
          href="/sales/new"
          icon={FilePlus}
        />
        <QuickActionTile
          label="POS"
          description="Touch-friendly quick sale."
          href="/pos"
          icon={Zap}
        />
        <QuickActionTile
          label="New invoice"
          description="Bill a client and track balance."
          href="/invoices/new"
          icon={FileText}
        />
        <QuickActionTile
          label="New quote"
          description="Send a quote a client can accept."
          href="/quotes/new"
          icon={FileCheck}
        />
      </div>

      {/* More overflow */}
      <div className="flex justify-end -mt-2">
        <details className="relative">
          <summary className="list-none cursor-pointer inline-flex items-center gap-1 text-[13px] font-medium text-nexpura-charcoal-700 hover:text-nexpura-bronze transition-colors">
            More <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />
          </summary>
          <div className="absolute right-0 mt-2 w-56 rounded-xl border border-nexpura-taupe-100 bg-white shadow-md py-1 z-10">
            <Link href="/sales" className="flex items-center gap-2 px-3 py-2 text-[13px] text-nexpura-charcoal-700 hover:bg-nexpura-champagne">
              <Search className="w-4 h-4" strokeWidth={1.5} /> Find sale
            </Link>
            <Link href="/invoices" className="flex items-center gap-2 px-3 py-2 text-[13px] text-nexpura-charcoal-700 hover:bg-nexpura-champagne">
              <FileText className="w-4 h-4" strokeWidth={1.5} /> Invoices
            </Link>
            <Link href="/quotes" className="flex items-center gap-2 px-3 py-2 text-[13px] text-nexpura-charcoal-700 hover:bg-nexpura-champagne">
              <FileCheck className="w-4 h-4" strokeWidth={1.5} /> Quotes
            </Link>
            <Link href="/laybys" className="flex items-center gap-2 px-3 py-2 text-[13px] text-nexpura-charcoal-700 hover:bg-nexpura-champagne">
              <Calendar className="w-4 h-4" strokeWidth={1.5} /> Laybys
            </Link>
            <Link href="/refunds" className="flex items-center gap-2 px-3 py-2 text-[13px] text-nexpura-charcoal-700 hover:bg-nexpura-champagne">
              <Undo2 className="w-4 h-4" strokeWidth={1.5} /> Refunds
            </Link>
            <Link href="/vouchers" className="flex items-center gap-2 px-3 py-2 text-[13px] text-nexpura-charcoal-700 hover:bg-nexpura-champagne">
              <Gift className="w-4 h-4" strokeWidth={1.5} /> Vouchers
            </Link>
            <Link href="/financials" className="flex items-center gap-2 px-3 py-2 text-[13px] text-nexpura-charcoal-700 hover:bg-nexpura-champagne">
              <PiggyBank className="w-4 h-4" strokeWidth={1.5} /> Customer deposits
            </Link>
          </div>
        </details>
      </div>

      {/* Recent sales panel */}
      {hasSales ? (
        <SectionPanel
          title="Recent sales"
          description="The most recent sales across every channel."
          action={{ label: "View all", href: "/sales" }}
        >
          <div className="p-5">
            <SalesListClient initialSales={initialSales} hideHeader limit={8} />
          </div>
        </SectionPanel>
      ) : (
        <SectionPanel title="Sales">
          <HubEmptyState
            icon={Receipt}
            title="No sales recorded yet"
            description="No sales recorded yet. Create a POS sale, invoice, quote or layby to begin tracking client revenue."
            ctas={[
              { label: "New Sale", href: "/sales/new", variant: "primary", icon: FilePlus },
              { label: "Open POS", href: "/pos", variant: "bronze", icon: ShoppingBag },
            ]}
          />
        </SectionPanel>
      )}
    </div>
  );
}
