export interface MetricsData {
  revenueThisMonth: number;
  revenueLastMonth: number;
  refundsThisMonth: number;
  refundCount: number;
  outstanding: number;
  outstandingCount: number;
  gstCollected: number;
  avgSaleValue: number;
  salesCount: number;
  paymentBreakdown: Record<string, number>;
  chartData: { date: string; label: string; revenue: number; refunds: number }[];
  quarterlyGST: { label: string; revenue: number; gst: number }[];
  gstRate: number;
}

export interface ReportData {
  from: string;
  to: string;
  totalRevenue: number;
  totalRefunds: number;
  netRevenue: number;
  gstCollected: number;
  totalTransactions: number;
  avgSaleValue: number;
  revenueByCategory: { posSales: number; invoices: number; repairs: number; bespoke: number };
  topCustomers: { name: string; total: number }[];
  topProducts: { name: string; qty: number; revenue: number }[];
  paymentBreakdown: Record<string, number>;
  chartData: { label: string; revenue: number; refunds: number }[];
  useWeekly: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
