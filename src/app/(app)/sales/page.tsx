import { getSales } from "./sales-actions";
import SalesListClient from "./SalesListClient";

export default async function SalesPage() {
  // Initial load with no location filter (all locations)
  const initialSales = await getSales(null);

  return <SalesListClient initialSales={initialSales} />;
}
