import { getDashboardCriticalData, getDashboardStats } from "./actions";
import DashboardWrapper from "./DashboardWrapper";
import logger from "@/lib/logger";

export default async function DashboardPage() {
  // Fetch both in parallel on the server. Critical data is fast (cached 15 min);
  // stats trigger 20 parallel queries but are cached 5 min. Previously only
  // critical data ran server-side and stats kicked off via a *post-hydration*
  // SWR fetch — i.e. the user paid one extra client→server round-trip on every
  // cold load, after the bundle had already downloaded + React hydrated.
  // Running stats server-side in parallel with critical data removes that
  // round-trip entirely and lets the dashboard stream in populated.
  //
  // Stats are fetched with `null` (all locations). The client's SWR hook uses
  // these as `fallbackData`; if the user's LocationContext default filters to
  // a specific location it'll revalidate in the background on mount.
  const [criticalData, initialStats] = await Promise.all([
    getDashboardCriticalData(),
    getDashboardStats(null).catch((err) => {
      logger.error("[DashboardPage] initial stats fetch failed, falling back to client-side fetch:", err);
      return null;
    }),
  ]);

  return <DashboardWrapper criticalData={criticalData} initialStats={initialStats} />;
}
