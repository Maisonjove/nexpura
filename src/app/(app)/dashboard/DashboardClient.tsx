"use client";

import { useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ActivityItem = {
  id: string;
  title: string;
  stage: string;
  customerName: string | null;
  updatedAt: string;
  type: "job" | "repair";
  href: string;
};

interface DashboardClientProps {
  firstName: string;
  tenantName: string | null;
  // KPI data (live from DB)
  salesThisMonthRevenue: number;
  salesThisMonthCount: number;
  activeRepairsCount: number;
  activeJobsCount: number;
  totalOutstanding: number;
  overdueInvoiceCount: number;
  lowStockCount: number;
  overdueRepairsCount: number;
  recentActivity: ActivityItem[];
}

// ─── Sample data ─────────────────────────────────────────────────────────────

const SAMPLE_REPAIRS = [
  { customer: "Sarah Khoury", item: "Engagement Ring Resize", status: "In Workshop", due: "14 Mar", assigned: "Ben", id: "r1" },
  { customer: "Lina Haddad", item: "Replace Missing Diamond", status: "Ready for Pickup", due: "12 Mar", assigned: "Emma", id: "r2" },
  { customer: "David Moufarrej", item: "Polish Gold Bangle", status: "Awaiting Approval", due: "15 Mar", assigned: "Ben", id: "r3" },
  { customer: "Mia Tanaka", item: "Wedding Band Prong Repair", status: "Overdue", due: "10 Mar", assigned: "—", id: "r4" },
];

const SAMPLE_BESPOKE = [
  { customer: "Sarah Khoury", item: "Toi et Moi Ring", metal: "18k White Gold", stage: "CAD", due: "20 Mar", assigned: "Emma", id: "b1" },
  { customer: "David Moufarrej", item: "Emerald Tennis Bracelet", metal: "18k Yellow Gold", stage: "Approved", due: "28 Mar", assigned: "Ben", id: "b2" },
  { customer: "Mia Tanaka", item: "Custom Bridal Set", metal: "Platinum", stage: "Setting", due: "15 Mar", assigned: "Emma", id: "b3" },
  { customer: "Lina Haddad", item: "Charm Bracelet", metal: "18k Rose Gold", stage: "Enquiry", due: "10 Apr", assigned: "—", id: "b4" },
];

const BEST_SELLERS = [
  { name: "Diamond Engagement Ring", category: "Rings", sold: 3, revenue: "$18,400" },
  { name: "Tennis Bracelet 18k", category: "Bracelets", sold: 2, revenue: "$9,600" },
  { name: "Sapphire Pendant", category: "Pendants", sold: 4, revenue: "$7,200" },
  { name: "Diamond Stud Earrings", category: "Earrings", sold: 5, revenue: "$4,800" },
];

const QUICK_ACTIONS = [
  { label: "New Sale", href: "/sales/new", icon: "🛍" },
  { label: "New Customer", href: "/customers/new", icon: "👤" },
  { label: "New Repair", href: "/repairs/new", icon: "🔧" },
  { label: "New Bespoke Job", href: "/bespoke/new", icon: "💎" },
  { label: "New Invoice", href: "/invoices/new", icon: "📄" },
  { label: "Print Tags", href: "/settings/tags", icon: "🏷" },
  { label: "Issue Passport", href: "/passports", icon: "🛡" },
  { label: "AI Copilot", href: "/ai", icon: "✨" },
];

const ALERTS = [
  { text: "3 repairs past due date", href: "/repairs?stage=overdue", urgency: "red" },
  { text: "5 items below minimum stock", href: "/inventory", urgency: "orange" },
  { text: "3 invoices overdue", href: "/invoices", urgency: "red" },
  { text: "Toi et Moi Ring due in 2 days", href: "/bespoke", urgency: "yellow" },
];

const ACTIVITY_ICONS: Record<string, string> = {
  repair: "🔧",
  job: "💎",
};

function fmtCurrency(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardClient({
  firstName,
  tenantName,
  salesThisMonthRevenue,
  salesThisMonthCount,
  activeRepairsCount,
  activeJobsCount,
  totalOutstanding,
  overdueInvoiceCount,
  lowStockCount,
  overdueRepairsCount,
  recentActivity,
}: DashboardClientProps) {
  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 600, color: '#1C1917', letterSpacing: '-0.02em', margin: 0 }}>
          Good morning, {firstName}
        </h1>
        <p style={{ fontSize: '13px', color: '#A8A29E', marginTop: '4px' }}>
          {tenantName || 'Your Store'} · {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        {/* Quick actions */}
        <div style={{ display: 'inline-flex', marginTop: '16px', border: '1px solid #E7E5E4', borderRadius: '10px', overflow: 'hidden', backgroundColor: 'white' }}>
          {[
            { label: 'New Sale', href: '/sales/new' },
            { label: 'New Customer', href: '/customers/new' },
            { label: 'New Repair', href: '/repairs/new' },
            { label: 'New Job', href: '/bespoke/new' },
          ].map((action, i) => (
            <a key={action.label} href={action.href} style={{
              padding: '8px 16px', fontSize: '13px', fontWeight: 500, color: '#44403C',
              textDecoration: 'none', borderRight: i < 3 ? '1px solid #E7E5E4' : 'none',
              display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FAFAF9')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {action.label}
            </a>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Sales This Month', value: fmtCurrency(salesThisMonthRevenue), sub: `${salesThisMonthCount} sales`, color: '#059669' },
          { label: 'Active Repairs', value: String(activeRepairsCount), sub: `${overdueRepairsCount} overdue`, color: '#2563EB' },
          { label: 'Bespoke Jobs', value: String(activeJobsCount), sub: 'in production', color: '#7C3AED' },
          { label: 'Outstanding', value: fmtCurrency(totalOutstanding), sub: `${overdueInvoiceCount} overdue`, color: '#DC2626' },
        ].map((kpi) => (
          <div key={kpi.label} style={{
            backgroundColor: 'white', borderRadius: '14px',
            border: '1px solid #E7E5E4', padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#A8A29E', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>{kpi.label}</p>
            <p style={{ fontSize: '30px', fontWeight: 700, color: '#1C1917', margin: '10px 0 6px', letterSpacing: '-0.02em' }}>{kpi.value}</p>
            <p style={{ fontSize: '12px', color: kpi.sub.includes('overdue') || kpi.sub.includes('Overdue') ? '#DC2626' : '#A8A29E', margin: 0 }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Operations Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Repairs Card */}
        <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid #E7E5E4', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F5F5F4' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#1C1917' }}>Active Repairs</span>
            <a href="/repairs" style={{ fontSize: '12px', color: '#A8A29E', textDecoration: 'none' }}>View all →</a>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F5F5F4' }}>
                {['Customer', 'Item', 'Status', 'Due'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 600, color: '#A8A29E', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SAMPLE_REPAIRS.map((r) => {
                const statusColors: Record<string, { bg: string; color: string }> = {
                  'In Workshop': { bg: '#EFF6FF', color: '#1D4ED8' },
                  'Ready for Pickup': { bg: '#F0FDF4', color: '#15803D' },
                  'Awaiting Approval': { bg: '#FFFBEB', color: '#B45309' },
                  'Overdue': { bg: '#FEF2F2', color: '#B91C1C' },
                };
                const sc = statusColors[r.status] || { bg: '#F5F5F4', color: '#57534E' };
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #FAFAF9' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FAFAF9')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1C1917', fontWeight: 500 }}>{r.customer}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#57534E' }}>{r.item}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ backgroundColor: sc.bg, color: sc.color, borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: 600 }}>{r.status}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: r.status === 'Overdue' ? '#DC2626' : '#78716C', fontWeight: r.status === 'Overdue' ? 600 : 400 }}>{r.due}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Bespoke jobs */}
          <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid #E7E5E4', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#1C1917' }}>Bespoke Jobs</span>
              <a href="/bespoke" style={{ fontSize: '12px', color: '#A8A29E', textDecoration: 'none' }}>View all →</a>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {SAMPLE_BESPOKE.slice(0, 3).map((job) => (
                <div key={job.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: '#1C1917', margin: 0 }}>{job.item}</p>
                    <p style={{ fontSize: '11px', color: '#A8A29E', margin: '2px 0 0' }}>{job.customer}</p>
                  </div>
                  <span style={{ backgroundColor: '#F5F5F4', color: '#57534E', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: 500 }}>{job.stage}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid #E7E5E4', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '20px' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#1C1917', margin: '0 0 14px' }}>Alerts</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ALERTS.map((alert, i) => (
                <a key={i} href={alert.href} style={{
                  display: 'block', padding: '8px 10px 8px 14px',
                  borderLeft: `3px solid ${alert.urgency === 'red' ? '#EF4444' : alert.urgency === 'orange' ? '#F97316' : '#F59E0B'}`,
                  backgroundColor: '#FAFAF9', borderRadius: '0 8px 8px 0',
                  fontSize: '12px', color: '#44403C', textDecoration: 'none',
                }}>{alert.text}</a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Best Sellers */}
      <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid #E7E5E4', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F5F5F4' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#1C1917' }}>Best Sellers This Month</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #F5F5F4' }}>
              {['Item', 'Category', 'Units Sold', 'Revenue'].map(h => (
                <th key={h} style={{ padding: '10px 24px', textAlign: 'left', fontSize: '10px', fontWeight: 600, color: '#A8A29E', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BEST_SELLERS.map((item, i) => (
              <tr key={i} style={{ borderBottom: i < BEST_SELLERS.length - 1 ? '1px solid #FAFAF9' : 'none' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FAFAF9')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <td style={{ padding: '13px 24px', fontSize: '13px', fontWeight: 500, color: '#1C1917' }}>{item.name}</td>
                <td style={{ padding: '13px 24px', fontSize: '13px', color: '#78716C' }}>{item.category}</td>
                <td style={{ padding: '13px 24px', fontSize: '13px', color: '#78716C' }}>{item.sold}</td>
                <td style={{ padding: '13px 24px', fontSize: '13px', fontWeight: 600, color: '#1C1917' }}>{item.revenue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
