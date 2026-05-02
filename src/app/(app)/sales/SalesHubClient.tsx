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

import { ShoppingBag, Zap, FilePlus, FileText, Search, FileCheck, Calendar, Undo2, Gift, PiggyBank, Receipt } from "lucide-react";
import {
  HubHeader,
  KpiCard,
  KpiStrip,
  QuickActionGroup,
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
  avgOrderValue: number;
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
        subtitle="Sales, invoices, quotes and laybys across every channel."
        ctas={[
          { label: "New Sale", href: "/sales/new", variant: "primary", icon: FilePlus },
          { label: "POS / Quick Sale", href: "/pos", variant: "bronze", icon: Zap },
        ]}
      />

      {/* KPI strip — 6 cards */}
      <KpiStrip>
        <KpiCard
          label="Sales today"
          value={fmtCurrency(kpis.salesToday)}
          tone="neutral"
          href="/sales"
        />
        <KpiCard
          label="Sales this month"
          value={fmtCurrency(kpis.salesThisMonth)}
          tone="neutral"
          href="/sales"
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
        <KpiCard
          label="Avg order value"
          value={fmtCurrency(kpis.avgOrderValue)}
          tone="neutral"
          hint="This month"
        />
      </KpiStrip>

      {/* Quick actions */}
      <div className="space-y-6">
        <QuickActionGroup
          label="Transact"
          actions={[
            {
              label: "New Sale",
              description: "Record a counter or appointment sale with line items, taxes and payment.",
              href: "/sales/new",
              icon: FilePlus,
            },
            {
              label: "POS / Quick Sale",
              description: "Touch-friendly point of sale for in-store transactions.",
              href: "/pos",
              icon: Zap,
            },
            {
              label: "New Invoice",
              description: "Bill a client for goods or services and track the balance until paid.",
              href: "/invoices/new",
              icon: FileText,
            },
            {
              label: "New Quote",
              description: "Send a formal quote a client can accept and convert into a sale.",
              href: "/quotes/new",
              icon: FileCheck,
            },
          ]}
        />

        <QuickActionGroup
          label="Manage"
          actions={[
            {
              label: "Find sale",
              description: "Search and filter every sale across all locations.",
              href: "/sales",
              icon: Search,
            },
            {
              label: "Invoices",
              description: "Outstanding, overdue and paid invoices.",
              href: "/invoices",
              icon: FileText,
            },
            {
              label: "Quotes",
              description: "Open quotes and conversion history.",
              href: "/quotes",
              icon: FileCheck,
            },
            {
              label: "Laybys",
              description: "Active laybys, balances and scheduled payments.",
              href: "/laybys",
              icon: Calendar,
            },
          ]}
        />

        <QuickActionGroup
          label="Additional"
          actions={[
            {
              label: "Refunds",
              description: "Process returns and refund payments.",
              href: "/refunds",
              icon: Undo2,
            },
            {
              label: "Gift vouchers",
              description: "Issue and redeem gift vouchers and store credit.",
              href: "/vouchers",
              icon: Gift,
            },
            {
              label: "Customer deposits",
              // /finance/deposits doesn't exist — falling back to /financials
              // (closest module per brief's note).
              description: "Track deposits taken against future orders or repairs.",
              href: "/financials",
              icon: PiggyBank,
            },
          ]}
        />
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
