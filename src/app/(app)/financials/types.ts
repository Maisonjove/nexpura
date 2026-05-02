/**
 * Finance Hub data shapes — Section 8.1 of Kaitlyn's 2026-05-02 redesign
 * brief. Kept separate from the legacy `components/types.ts` so the
 * existing FinancialsClient (AI dashboard / report tab) data shapes are
 * untouched.
 */

export interface OverdueInvoice {
  id: string;
  invoiceNumber: string;
  total: number;
  amountDue: number;
  dueDate: string | null;
  customer: string;
}

export interface UpcomingPayment {
  id: string;
  invoiceNumber: string;
  total: number;
  amountDue: number;
  dueDate: string | null;
  customer: string;
}

export interface RecentPayment {
  id: string;
  invoiceNumber: string;
  total: number;
  paidAt: string | null;
  customer: string;
}

export interface FinanceHubData {
  overdueInvoices: OverdueInvoice[];
  upcomingPayments: UpcomingPayment[];
  recentPayments: RecentPayment[];
  outstandingTotal: number;
  overdueAmount: number;
  paidThisMonth: number;
  expensesThisMonth: number;
  refundsThisMonth: number;
  netRevenue: number;
  /** Whether today's reconciliation has been started in /eod. */
  reconciliationStarted: boolean;
}
