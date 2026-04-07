"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Prefetches critical routes on mount to make navigation instant.
 * These are the most commonly accessed pages after login.
 */
const CRITICAL_ROUTES = [
  "/dashboard",
  "/pos",
  "/inventory",
  "/customers",
  "/repairs",
  "/invoices",
  "/bespoke",
  "/sales",
];

export function RoutePrefetcher() {
  const router = useRouter();

  useEffect(() => {
    // Delay prefetching slightly to not compete with initial page load
    const timer = setTimeout(() => {
      CRITICAL_ROUTES.forEach((route) => {
        router.prefetch(route);
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [router]);

  return null;
}
