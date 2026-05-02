"use client";

/**
 * Finance Hub — Section 8.1 of Kaitlyn's 2026-05-02 redesign brief.
 *
 *   1. HubHeader (H1 + subtitle + "New invoice" CTA)
 *   2. KPI strip (6 cards) — outstanding / overdue / paid this month /
 *      expenses / refunds / net revenue
 *   3. Finance overview panel — top 5 overdue, outstanding total,
 *      upcoming payments, recent payments, EOD reconciliation status
 *   4. Quick actions (INVOICES & PAYMENTS / EXPENSES & REFUNDS / OPERATIONS)
 *   5. Detailed dashboard — wraps the existing FinancialsClient so the
 *      AI insights, revenue chart and report tab continue to work.
 */

import Link from "next/link";
import {
  FilePlus,
  FileText,
  Receipt,
  Undo2,
  Gift,
  TrendingUp,
  CheckSquare,
  BarChart3,
  FileDown,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Wallet,
} from "lucide-react";
import {
  HubHeader,
  KpiCard,
  KpiStrip,
  QuickActionGroup,
  SectionPanel,
  HubEmptyState,
} from "@/components/hub/HubPrimitives";
import FinancialsClient from "./FinancialsClient";
import type { MetricsData } from "./components/types";
import type { FinanceHubData } from "./types";

interface Props {
  tenantId: string;
  businessName: string;
  gstRate: number;
  currency?: string;
  initialMetrics?: MetricsData | null;
  hubData: FinanceHubData;
}

function fmtCurrency(amount: number, currency: string = "AUD"): string {
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${Math.round(amount).toLocaleString()}`;
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export default function FinanceHubClient({
  tenantId,
  businessName,
  gstRate,
  currency = "AUD",
  initialMetrics = null,
  hubData,
}: Props) {
  const hasOverdue = hubData.overdueInvoices.length > 0;
  const hasUpcoming = hubData.upcomingPayments.length > 0;
  const hasRecent = hubData.recentPayments.length > 0;

  return (
    <div className="space-y-7 max-w-[1400px]">
      <HubHeader
        title="Finance"
        subtitle="Track invoices, payments, expenses, refunds and reconciliation."
        ctas={[
          { label: "New invoice", href: "/invoices/new", variant: "primary", icon: FilePlus },
        ]}
      />

      {/* KPI strip — 6 cards */}
      <KpiStrip>
        <KpiCard
          label="Outstanding invoices"
          value={fmtCurrency(hubData.outstandingTotal, currency)}
          href="/invoices"
          tone={hubData.outstandingTotal > 0 ? "warn" : "neutral"}
        />
        <KpiCard
          label="Overdue amount"
          value={fmtCurrency(hubData.overdueAmount, currency)}
          href="/invoices?status=overdue"
          tone={hubData.overdueAmount > 0 ? "danger" : "neutral"}
        />
        <KpiCard
          label="Paid this month"
          value={fmtCurrency(hubData.paidThisMonth, currency)}
          href="/sales"
          tone="success"
        />
        <KpiCard
          label="Expenses this month"
          value={fmtCurrency(hubData.expensesThisMonth, currency)}
          href="/expenses"
          tone="neutral"
        />
        <KpiCard
          label="Refunds this month"
          value={fmtCurrency(hubData.refundsThisMonth, currency)}
          href="/refunds"
          tone="neutral"
        />
        <KpiCard
          label="Net revenue"
          value={fmtCurrency(hubData.netRevenue, currency)}
          tone={hubData.netRevenue >= 0 ? "neutral" : "danger"}
          hint="This month"
        />
      </KpiStrip>

      {/* Finance overview panel — left column has overdue + upcoming + recent;
          right column has reconciliation summary. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SectionPanel
            title="Top overdue invoices"
            description={
              hasOverdue
                ? `Outstanding total ${fmtCurrency(hubData.outstandingTotal, currency)}.`
                : undefined
            }
            action={{ label: "All invoices", href: "/invoices?status=overdue" }}
          >
            {hasOverdue ? (
              <ul className="divide-y divide-nexpura-taupe-100">
                {hubData.overdueInvoices.map((inv) => (
                  <li key={inv.id}>
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="flex items-start gap-3 px-5 py-4 hover:bg-nexpura-warm-tint transition-colors"
                    >
                      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-nexpura-oxblood-bg border border-nexpura-oxblood/20 flex items-center justify-center text-nexpura-oxblood">
                        <AlertTriangle className="w-[18px] h-[18px]" strokeWidth={1.5} aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-sans text-[14px] font-semibold text-nexpura-charcoal truncate">
                          {inv.invoiceNumber}
                        </p>
                        <p className="font-sans text-[12px] text-nexpura-charcoal-500 mt-0.5 truncate">
                          {inv.customer} · due {fmtDate(inv.dueDate)}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="font-sans text-[14px] font-semibold text-nexpura-oxblood tabular-nums">
                          {fmtCurrency(inv.amountDue, currency)}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <HubEmptyState
                icon={CheckCircle2}
                title="No overdue invoices"
                description="All invoices are paid or within their due date."
              />
            )}
          </SectionPanel>

          <SectionPanel
            title="Upcoming payments"
            description="Invoices due in the next 7 days."
            action={{ label: "All invoices", href: "/invoices" }}
          >
            {hasUpcoming ? (
              <ul className="divide-y divide-nexpura-taupe-100">
                {hubData.upcomingPayments.map((inv) => (
                  <li key={inv.id}>
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="flex items-start gap-3 px-5 py-4 hover:bg-nexpura-warm-tint transition-colors"
                    >
                      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-nexpura-warm border border-nexpura-taupe-100 flex items-center justify-center text-nexpura-charcoal-700">
                        <CalendarClock className="w-[18px] h-[18px]" strokeWidth={1.5} aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-sans text-[14px] font-semibold text-nexpura-charcoal truncate">
                          {inv.invoiceNumber}
                        </p>
                        <p className="font-sans text-[12px] text-nexpura-charcoal-500 mt-0.5 truncate">
                          {inv.customer} · due {fmtDate(inv.dueDate)}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="font-sans text-[14px] font-semibold text-nexpura-charcoal tabular-nums">
                          {fmtCurrency(inv.amountDue, currency)}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-5 py-6 text-[13px] text-nexpura-charcoal-500">
                No payments due in the next 7 days.
              </div>
            )}
          </SectionPanel>

          <SectionPanel
            title="Recent payments"
            description="The last 5 invoices marked paid."
            action={{ label: "Sales", href: "/sales" }}
          >
            {hasRecent ? (
              <ul className="divide-y divide-nexpura-taupe-100">
                {hubData.recentPayments.map((pay) => (
                  <li key={pay.id}>
                    <Link
                      href={`/invoices/${pay.id}`}
                      className="flex items-start gap-3 px-5 py-4 hover:bg-nexpura-warm-tint transition-colors"
                    >
                      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-nexpura-emerald-bg border border-nexpura-emerald-deep/20 flex items-center justify-center text-nexpura-emerald-deep">
                        <CheckCircle2 className="w-[18px] h-[18px]" strokeWidth={1.5} aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-sans text-[14px] font-semibold text-nexpura-charcoal truncate">
                          {pay.invoiceNumber}
                        </p>
                        <p className="font-sans text-[12px] text-nexpura-charcoal-500 mt-0.5 truncate">
                          {pay.customer} · paid {fmtDate(pay.paidAt)}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="font-sans text-[14px] font-semibold text-nexpura-emerald-deep tabular-nums">
                          {fmtCurrency(pay.total, currency)}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-5 py-6 text-[13px] text-nexpura-charcoal-500">
                No payments recorded yet this period.
              </div>
            )}
          </SectionPanel>
        </div>

        <div className="space-y-6">
          <SectionPanel title="End of day">
            <div className="px-5 py-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-nexpura-warm border border-nexpura-taupe-100 flex items-center justify-center text-nexpura-charcoal-700">
                  <Wallet className="w-[18px] h-[18px]" strokeWidth={1.5} aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="font-sans text-[14px] font-semibold text-nexpura-charcoal">
                    {hubData.reconciliationStarted
                      ? "Today's reconciliation in progress"
                      : "Today's reconciliation not started"}
                  </p>
                  <p className="font-sans text-[12px] text-nexpura-charcoal-500 mt-0.5 leading-relaxed">
                    Count cash, reconcile card payments and close the till for the day.
                  </p>
                </div>
              </div>
              <Link
                href="/eod"
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-nexpura-charcoal text-white hover:bg-nexpura-charcoal-700 transition-colors"
              >
                <CheckSquare className="w-4 h-4" strokeWidth={1.5} aria-hidden />
                {hubData.reconciliationStarted ? "Continue reconciliation" : "Start reconciliation"}
              </Link>
            </div>
          </SectionPanel>

          <SectionPanel title="This month at a glance">
            <dl className="px-5 py-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <dt className="font-sans text-[12px] uppercase tracking-[0.12em] text-nexpura-taupe-400">Paid</dt>
                <dd className="font-sans text-[14px] font-medium text-nexpura-emerald-deep tabular-nums">
                  {fmtCurrency(hubData.paidThisMonth, currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-sans text-[12px] uppercase tracking-[0.12em] text-nexpura-taupe-400">Expenses</dt>
                <dd className="font-sans text-[14px] font-medium text-nexpura-charcoal tabular-nums">
                  −{fmtCurrency(hubData.expensesThisMonth, currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-sans text-[12px] uppercase tracking-[0.12em] text-nexpura-taupe-400">Refunds</dt>
                <dd className="font-sans text-[14px] font-medium text-nexpura-charcoal tabular-nums">
                  −{fmtCurrency(hubData.refundsThisMonth, currency)}
                </dd>
              </div>
              <div className="border-t border-nexpura-taupe-100 pt-3 flex items-center justify-between gap-3">
                <dt className="font-sans text-[12px] uppercase tracking-[0.12em] text-nexpura-charcoal-700 font-semibold">Net revenue</dt>
                <dd className={`font-sans text-[16px] font-semibold tabular-nums ${
                  hubData.netRevenue >= 0 ? "text-nexpura-charcoal" : "text-nexpura-oxblood"
                }`}>
                  {fmtCurrency(hubData.netRevenue, currency)}
                </dd>
              </div>
            </dl>
          </SectionPanel>
        </div>
      </div>

      {/* Quick actions */}
      <div className="space-y-6">
        <QuickActionGroup
          label="Invoices & Payments"
          actions={[
            {
              label: "Invoices",
              description: "Outstanding, overdue and paid invoices across every channel.",
              href: "/invoices",
              icon: FileText,
            },
            {
              label: "New invoice",
              description: "Bill a client for goods or services and track the balance.",
              href: "/invoices/new",
              icon: FilePlus,
            },
            {
              label: "Record payment",
              description: "Apply a payment to an existing invoice or sale.",
              // /invoices is the closest entry point — payment recording
              // happens inside the invoice detail today.
              href: "/invoices",
              icon: Receipt,
            },
          ]}
        />

        <QuickActionGroup
          label="Expenses & Refunds"
          actions={[
            {
              label: "Expenses",
              description: "Track and categorise business expenses.",
              href: "/expenses",
              icon: Receipt,
            },
            {
              label: "Refunds",
              description: "Process returns and refund payments.",
              href: "/refunds",
              icon: Undo2,
            },
            {
              label: "Vouchers",
              description: "Issue and redeem gift vouchers and store credit.",
              href: "/vouchers",
              icon: Gift,
            },
          ]}
        />

        <QuickActionGroup
          label="Operations"
          actions={[
            {
              label: "End of day",
              description: "Close the till and reconcile cash and card payments.",
              href: "/eod",
              icon: CheckSquare,
            },
            {
              label: "Reconciliation",
              description: "Match payments to bank deposits and resolve variances.",
              href: "/eod",
              icon: TrendingUp,
            },
            {
              label: "Reports",
              description: "Sales, customer, expense and inventory reports.",
              href: "/reports",
              icon: BarChart3,
            },
            {
              label: "Tax / export",
              description: "Quarterly GST summary and exportable expense reports.",
              // /reports/expenses exists in the codebase; falls back to
              // /reports if a specific export panel isn't wired yet.
              href: "/reports/expenses",
              icon: FileDown,
            },
          ]}
        />
      </div>

      {/* Existing detailed dashboard — wraps FinancialsClient so AI insights,
          revenue chart and the reports tab continue to work below the hub. */}
      <SectionPanel
        title="Detailed financials"
        description={`${businessName} · AI insights, revenue chart, GST summary and reports.`}
      >
        <div className="px-5 py-5">
          <FinancialsClient
            tenantId={tenantId}
            businessName={businessName}
            gstRate={gstRate}
            currency={currency}
            initialMetrics={initialMetrics}
          />
        </div>
      </SectionPanel>
    </div>
  );
}
