"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load the Sparkline component which uses recharts (~400KB)
const Sparkline = dynamic(
  () => import("./sparkline").then((m) => ({ default: m.Sparkline })),
  {
    ssr: false,
    loading: () => <Skeleton className="w-full h-10" />,
  }
);

interface LazySparklineProps {
  data: { value: number }[];
  color?: string;
}

export function LazySparkline({ data, color }: LazySparklineProps) {
  return <Sparkline data={data} color={color} />;
}
