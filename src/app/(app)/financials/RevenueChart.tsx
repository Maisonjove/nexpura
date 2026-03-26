'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load recharts (~400KB)
const LineChart = dynamic(() => import('recharts').then(m => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(m => m.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then(m => m.Legend), { ssr: false });
const ResponsiveContainer = dynamic(
  () => import('recharts').then(m => m.ResponsiveContainer),
  { ssr: false, loading: () => <Skeleton className="w-full h-48" /> }
);

interface DataPoint {
  label: string;
  revenue: number;
  refunds: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

// Show every Nth label to avoid crowding
function tickFormatter(value: string, index: number, total: number) {
  const every = total <= 15 ? 1 : total <= 30 ? 3 : 7;
  if (index % every !== 0) return '';
  return value;
}

export default function RevenueChart({ data }: { data: DataPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-stone-400">
        No data for this period
      </div>
    );
  }

  const total = data.length;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v, i) => tickFormatter(v, i, total)}
        />
        <YAxis
          tickFormatter={(v) => fmt(v)}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          width={70}
        />
        <Tooltip
          formatter={(value, name) => [
            fmt(Number(value ?? 0)),
            name === 'revenue' ? 'Revenue' : 'Refunds',
          ]}
          contentStyle={{
            border: '1px solid #e7e5e4',
            borderRadius: '8px',
            fontSize: '12px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}
          labelStyle={{ color: '#57534e', fontWeight: 600, marginBottom: 4 }}
        />
        <Legend
          wrapperStyle={{ fontSize: '12px', color: '#6b7280' }}
          formatter={(v) => (v === 'revenue' ? 'Revenue' : 'Refunds')}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="amber-700"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="refunds"
          stroke="#ef4444"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
