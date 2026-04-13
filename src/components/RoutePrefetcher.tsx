"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Prefetches all app routes on mount to make navigation instant.
 * Split into two batches so prefetching doesn't compete with initial page load.
 */
const PRIMARY_ROUTES = [
  "/dashboard",
  "/pos",
  "/inventory",
  "/customers",
  "/repairs",
  "/invoices",
  "/bespoke",
  "/sales",
];

const SECONDARY_ROUTES = [
  "/suppliers",
  "/expenses",
  "/communications",
  "/reports",
  "/marketing",
  "/ai",
  "/settings",
  "/passports",
  "/financials",
  "/quotes",
  "/laybys",
  "/tasks",
  "/notifications",
];

export function RoutePrefetcher() {
  const router = useRouter();

  useEffect(() => {
    // Primary routes: prefetch after 1s (most frequently visited pages)
    const t1 = setTimeout(() => {
      PRIMARY_ROUTES.forEach((route) => {
        router.prefetch(route);
      });
    }, 1000);

    // Secondary routes: prefetch after 3s (less critical pages)
    const t2 = setTimeout(() => {
      SECONDARY_ROUTES.forEach((route) => {
        router.prefetch(route);
      });
    }, 3000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [router]);

  return null;
}