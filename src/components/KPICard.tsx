import React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";

interface KPICardProps {
  label: string;
  value: string;
  sublabel?: string;
  trend?: "up" | "down" | "neutral";
  trendText?: string;
  color?: "default" | "success" | "warning" | "danger";
  href?: string;
  icon?: React.ReactNode;
}

export default function KPICard({
  label,
  value,
  sublabel,
  trend,
  trendText,
  color = "default",
  href,
  icon,
}: KPICardProps) {
  const card = (
    <Card className="p-6 bg-white border-stone-200 shadow-none hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-stone-400 uppercase tracking-widest">
          {label}
        </p>
        {icon && (
          <span className="text-stone-300">{icon}</span>
        )}
      </div>
      <p className="text-2xl font-semibold text-stone-900 mt-1">{value}</p>
      {sublabel && (
        <p className="text-xs text-stone-400 mt-0.5">{sublabel}</p>
      )}
      {trendText && (
        <p className="text-xs text-stone-400 mt-0.5 flex items-center gap-1">
          {trend === "up" && (
            <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          )}
          {trend === "down" && (
            <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
          {trendText}
        </p>
      )}
    </Card>
  );

  if (href) {
    return <Link href={href}>{card}</Link>;
  }
  return card;
}
