import React from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  changePositive?: boolean;
  icon?: React.ReactNode;
  alert?: boolean;
  sub?: string;
}

export function StatsCard({ title, value, change, changePositive, icon, alert, sub }: StatsCardProps) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">{title}</p>
        {icon && (
          <div className="w-8 h-8 bg-stone-50 border border-stone-200 rounded-lg flex items-center justify-center text-stone-400">
            {icon}
          </div>
        )}
      </div>
      <p className={`text-2xl font-semibold tracking-tight ${alert ? 'text-rose-600' : 'text-stone-900'}`}>
        {value}
      </p>
      {(sub || change) && (
        <div className="mt-1.5 flex items-center gap-2">
          {sub && <span className={`text-xs ${alert ? 'text-rose-400' : 'text-stone-400'}`}>{sub}</span>}
          {change && (
            <span className={`text-xs font-medium ${changePositive ? 'text-emerald-600' : 'text-rose-600'}`}>
              {changePositive ? '↑' : '↓'} {change}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
