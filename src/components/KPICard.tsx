import React from "react";
import Link from "next/link";

interface KPICardProps {
  label: string;
  value: string;
  sublabel?: string;
  trend?: "up" | "down" | "neutral";
  trendText?: string;
  color?: "default" | "success" | "warning" | "danger";
  href?: string;
}

const colorDot: Record<string, string> = {
  default: "bg-[#E8F0EB]",
  success: "bg-green-100",
  warning: "bg-amber-100",
  danger: "bg-red-100",
};

const colorText: Record<string, string> = {
  default: "text-[#1a4731]",
  success: "text-green-600",
  warning: "text-amber-600",
  danger: "text-red-500",
};

export default function KPICard({
  label,
  value,
  sublabel,
  trend,
  trendText,
  color = "default",
  href,
}: KPICardProps) {
  const card = (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-[#E8E6E1] hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#9A9A9A]">
          {label}
        </span>
        <span className={`w-2 h-2 rounded-full mt-1 ${colorDot[color]}`} />
      </div>
      <p className="text-2xl font-semibold text-[#1C1C1E] mt-1">{value}</p>
      {sublabel && (
        <p className={`text-xs mt-1 ${colorText[color]}`}>{sublabel}</p>
      )}
      {trendText && (
        <p className="text-xs mt-1 text-[#6B6B6B] flex items-center gap-1">
          {trend === "up" && (
            <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    </div>
  );

  if (href) {
    return <Link href={href}>{card}</Link>;
  }
  return card;
}
