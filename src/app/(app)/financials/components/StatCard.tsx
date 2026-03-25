import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: string | null;
  icon: React.ReactNode;
  urgent?: boolean;
}

export default function StatCard({ label, value, sub, trend, icon, urgent }: StatCardProps) {
  const up = trend && parseFloat(trend) >= 0;
  return (
    <div className={`bg-white rounded-xl border ${urgent ? 'border-red-200' : 'border-stone-200'} p-5 shadow-sm`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${urgent ? 'bg-red-50 text-red-500' : 'bg-stone-100 text-amber-700'}`}>
          {icon}
        </div>
      </div>
      <p className={`font-semibold text-2xl ${urgent ? 'text-red-500' : 'text-stone-900'}`}>{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-1">{sub}</p>}
      {trend && (
        <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${up ? 'text-emerald-600' : 'text-red-500'}`}>
          {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {up ? '+' : ''}{trend}% vs last month
        </div>
      )}
    </div>
  );
}
