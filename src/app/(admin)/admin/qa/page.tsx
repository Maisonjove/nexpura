import { createAdminClient } from "@/lib/supabase/admin";
import QADashboardClient from "./QADashboardClient";
import logger from "@/lib/logger";


// Mock data for when database tables don't exist
const mockCategories = [
  { id: '11111111-1111-1111-1111-111111111101', name: 'Authentication & Onboarding', description: 'User registration, login, password reset, onboarding flows', icon: 'shield', sort_order: 1 },
  { id: '11111111-1111-1111-1111-111111111102', name: 'Dashboard & Navigation', description: 'Main dashboard, sidebar navigation, quick actions', icon: 'layout', sort_order: 2 },
  { id: '11111111-1111-1111-1111-111111111103', name: 'Repairs & Workshop', description: 'Repair jobs, workshop management, job lifecycle', icon: 'wrench', sort_order: 3 },
  { id: '11111111-1111-1111-1111-111111111104', name: 'Bespoke Orders', description: 'Custom jewelry orders, design process, approvals', icon: 'gem', sort_order: 4 },
  { id: '11111111-1111-1111-1111-111111111105', name: 'Point of Sale', description: 'POS terminal, checkout, payments, receipts', icon: 'shopping-cart', sort_order: 5 },
  { id: '11111111-1111-1111-1111-111111111106', name: 'Inventory Management', description: 'Stock levels, products, categories, transfers', icon: 'package', sort_order: 6 },
  { id: '11111111-1111-1111-1111-111111111107', name: 'Customer Management', description: 'Customer profiles, history, communications', icon: 'users', sort_order: 7 },
  { id: '11111111-1111-1111-1111-111111111108', name: 'Invoices & Quotes', description: 'Invoice creation, quotes, PDF generation', icon: 'file-text', sort_order: 8 },
  { id: '11111111-1111-1111-1111-111111111109', name: 'Financial Reports', description: 'Revenue reports, EOD reconciliation, expenses', icon: 'trending-up', sort_order: 9 },
  { id: '11111111-1111-1111-1111-111111111110', name: 'Settings & Configuration', description: 'Business settings, team, roles, integrations', icon: 'settings', sort_order: 10 },
  { id: '11111111-1111-1111-1111-111111111111', name: 'Marketing & Campaigns', description: 'Email campaigns, SMS, WhatsApp, analytics', icon: 'megaphone', sort_order: 11 },
  { id: '11111111-1111-1111-1111-111111111112', name: 'Data Migration', description: 'Import tools, file uploads, mapping, execution', icon: 'upload', sort_order: 12 },
  { id: '11111111-1111-1111-1111-111111111113', name: 'Appraisals & Passports', description: 'Jewelry appraisals, digital passports, certificates', icon: 'award', sort_order: 13 },
  { id: '11111111-1111-1111-1111-111111111114', name: 'Tasks & Workflow', description: 'Task management, assignments, notifications', icon: 'check-square', sort_order: 14 },
  { id: '11111111-1111-1111-1111-111111111115', name: 'Integrations', description: 'Stripe, Xero, Google Calendar, WhatsApp, Shopify', icon: 'plug', sort_order: 15 },
  { id: '11111111-1111-1111-1111-111111111116', name: 'Customer-Facing Website', description: 'Shop pages, appointments, enquiries, tracking', icon: 'globe', sort_order: 16 },
  { id: '11111111-1111-1111-1111-111111111117', name: 'Mobile & Responsiveness', description: 'Mobile layouts, touch interactions, PWA', icon: 'smartphone', sort_order: 17 },
  { id: '11111111-1111-1111-1111-111111111118', name: 'Security & Permissions', description: 'Role-based access, data protection, audit logs', icon: 'lock', sort_order: 18 },
  { id: '11111111-1111-1111-1111-111111111119', name: 'Performance & Reliability', description: 'Load times, error handling, edge cases', icon: 'zap', sort_order: 19 },
  { id: '11111111-1111-1111-1111-111111111120', name: 'Billing & Subscriptions', description: 'Plan management, payments, Stripe billing', icon: 'credit-card', sort_order: 20 },
];

const mockItems = [
  // Auth (8)
  { id: 'a1', category_id: '11111111-1111-1111-1111-111111111101', title: 'User can sign up with email', description: 'New user registration with email and password', route: '/signup', testing_guidance: 'Create new account with valid email. Verify confirmation email is sent.', priority: 'critical', sort_order: 1, qa_test_results: [{ status: 'pass', tester_name: 'Joey', tested_at: '2024-03-21T10:00:00Z' }] },
  { id: 'a2', category_id: '11111111-1111-1111-1111-111111111101', title: 'User can log in', description: 'Existing user login with email/password', route: '/login', testing_guidance: 'Login with valid credentials. Check redirect to dashboard.', priority: 'critical', sort_order: 2, qa_test_results: [{ status: 'pass', tester_name: 'Joey' }] },
  { id: 'a3', category_id: '11111111-1111-1111-1111-111111111101', title: 'Password reset flow works', description: 'Forgot password and reset flow', route: '/forgot-password', testing_guidance: 'Request password reset. Check email received. Reset password successfully.', priority: 'critical', sort_order: 3, qa_test_results: [{ status: 'fail', notes: 'Email not sending in production', tester_name: 'Teo' }] },
  { id: 'a4', category_id: '11111111-1111-1111-1111-111111111101', title: 'Onboarding wizard completes', description: 'New user onboarding steps', route: '/onboarding', testing_guidance: 'Complete all onboarding steps. Business name, settings, etc.', priority: 'high', sort_order: 4, qa_test_results: [{ status: 'pass' }] },
  { id: 'a5', category_id: '11111111-1111-1111-1111-111111111101', title: 'Session persists across refreshes', description: 'User stays logged in after page refresh', route: '/dashboard', testing_guidance: 'Login, refresh page, verify still logged in.', priority: 'high', sort_order: 5, qa_test_results: [{ status: 'pass' }] },
  { id: 'a6', category_id: '11111111-1111-1111-1111-111111111101', title: 'Logout works correctly', description: 'User can log out and session is cleared', route: '/dashboard', testing_guidance: 'Click logout. Verify redirected to login.', priority: 'high', sort_order: 6, qa_test_results: [{ status: 'pending' }] },
  { id: 'a7', category_id: '11111111-1111-1111-1111-111111111101', title: 'Invalid login shows error', description: 'Error message for wrong credentials', route: '/login', testing_guidance: 'Try invalid password. Should show clear error message.', priority: 'medium', sort_order: 7, qa_test_results: [{ status: 'pass' }] },
  { id: 'a8', category_id: '11111111-1111-1111-1111-111111111101', title: 'Team member invite works', description: 'Invite new team member via email', route: '/settings/team', testing_guidance: 'Send invite. Check email received.', priority: 'high', sort_order: 8, qa_test_results: [{ status: 'pending' }] },
  
  // Dashboard (6)
  { id: 'd1', category_id: '11111111-1111-1111-1111-111111111102', title: 'Dashboard loads with stats', description: 'Main dashboard shows key metrics', route: '/dashboard', testing_guidance: 'Dashboard shows revenue, orders, tasks summary.', priority: 'critical', sort_order: 1, qa_test_results: [{ status: 'pass' }] },
  { id: 'd2', category_id: '11111111-1111-1111-1111-111111111102', title: 'Sidebar navigation works', description: 'All sidebar links navigate correctly', route: '/dashboard', testing_guidance: 'Click each sidebar item. Verify correct page loads.', priority: 'critical', sort_order: 2, qa_test_results: [{ status: 'pass' }] },
  { id: 'd3', category_id: '11111111-1111-1111-1111-111111111102', title: 'Quick actions function', description: 'Dashboard quick action buttons work', route: '/dashboard', testing_guidance: 'Test New Repair, New Sale, New Customer buttons.', priority: 'high', sort_order: 3, qa_test_results: [{ status: 'pass' }] },
  { id: 'd4', category_id: '11111111-1111-1111-1111-111111111102', title: 'Recent activity shows', description: 'Dashboard shows recent transactions', route: '/dashboard', testing_guidance: 'Create activity. Verify it appears in recent section.', priority: 'medium', sort_order: 4, qa_test_results: [{ status: 'pending' }] },
  { id: 'd5', category_id: '11111111-1111-1111-1111-111111111102', title: 'Date range filter works', description: 'Dashboard date filters update data', route: '/dashboard', testing_guidance: 'Change date range. Verify stats update accordingly.', priority: 'medium', sort_order: 5, qa_test_results: [{ status: 'pending' }] },
  { id: 'd6', category_id: '11111111-1111-1111-1111-111111111102', title: 'Mobile sidebar toggle', description: 'Hamburger menu works on mobile', route: '/dashboard', testing_guidance: 'Test on mobile viewport. Sidebar opens/closes correctly.', priority: 'high', sort_order: 6, qa_test_results: [{ status: 'pass' }] },

  // Repairs (9)
  { id: 'r1', category_id: '11111111-1111-1111-1111-111111111103', title: 'Create new repair job', description: 'Full repair creation flow', route: '/repairs/new', testing_guidance: 'Create repair with customer, item details, pricing.', priority: 'critical', sort_order: 1, qa_test_results: [{ status: 'pass' }] },
  { id: 'r2', category_id: '11111111-1111-1111-1111-111111111103', title: 'Repair status transitions', description: 'Change repair status through lifecycle', route: '/repairs/[id]', testing_guidance: 'Move repair: Received → In Progress → Ready → Collected.', priority: 'critical', sort_order: 2, qa_test_results: [{ status: 'pass' }] },
  { id: 'r3', category_id: '11111111-1111-1111-1111-111111111103', title: 'Repair list filters work', description: 'Filter repairs by status, date, customer', route: '/repairs', testing_guidance: 'Apply various filters. Verify results match.', priority: 'high', sort_order: 3, qa_test_results: [{ status: 'fail', notes: 'Date filter not working correctly' }] },
  { id: 'r4', category_id: '11111111-1111-1111-1111-111111111103', title: 'Repair PDF generates', description: 'Generate and download repair PDF', route: '/repairs/[id]', testing_guidance: 'Click PDF button. PDF downloads with correct info.', priority: 'high', sort_order: 4, qa_test_results: [{ status: 'pass' }] },
  { id: 'r5', category_id: '11111111-1111-1111-1111-111111111103', title: 'Repair photos upload', description: 'Upload before/after photos', route: '/repairs/[id]', testing_guidance: 'Upload images. Verify they display correctly.', priority: 'medium', sort_order: 5, qa_test_results: [{ status: 'pending' }] },
  { id: 'r6', category_id: '11111111-1111-1111-1111-111111111103', title: 'Workshop calendar view', description: 'Calendar shows scheduled repairs', route: '/workshop/calendar', testing_guidance: 'View calendar. Repairs appear on correct dates.', priority: 'medium', sort_order: 6, qa_test_results: [{ status: 'pending' }] },
  { id: 'r7', category_id: '11111111-1111-1111-1111-111111111103', title: 'Repair search works', description: 'Search repairs by reference or customer', route: '/repairs', testing_guidance: 'Search by job number, customer name.', priority: 'high', sort_order: 7, qa_test_results: [{ status: 'pass' }] },
  { id: 'r8', category_id: '11111111-1111-1111-1111-111111111103', title: 'Repair edit works', description: 'Edit existing repair details', route: '/repairs/[id]/edit', testing_guidance: 'Edit repair. Save changes. Verify updates persist.', priority: 'high', sort_order: 8, qa_test_results: [{ status: 'pass' }] },
  { id: 'r9', category_id: '11111111-1111-1111-1111-111111111103', title: 'Customer notification sends', description: 'Send ready-for-collection notification', route: '/repairs/[id]', testing_guidance: 'Mark ready. Send notification.', priority: 'high', sort_order: 9, qa_test_results: [{ status: 'blocked', notes: 'Waiting for WhatsApp integration' }] },

  // POS (12) - Adding variety
  { id: 'p1', category_id: '11111111-1111-1111-1111-111111111105', title: 'POS loads correctly', description: 'POS interface loads without errors', route: '/pos', testing_guidance: 'Open POS. Interface renders.', priority: 'critical', sort_order: 1, qa_test_results: [{ status: 'pass' }] },
  { id: 'p2', category_id: '11111111-1111-1111-1111-111111111105', title: 'Add items to cart', description: 'Products can be added to sale', route: '/pos', testing_guidance: 'Click products. Items appear in cart.', priority: 'critical', sort_order: 2, qa_test_results: [{ status: 'pass' }] },
  { id: 'p3', category_id: '11111111-1111-1111-1111-111111111105', title: 'Quantity adjustments', description: 'Change item quantities in cart', route: '/pos', testing_guidance: 'Increase/decrease quantities.', priority: 'high', sort_order: 3, qa_test_results: [{ status: 'pass' }] },
  { id: 'p4', category_id: '11111111-1111-1111-1111-111111111105', title: 'Remove items from cart', description: 'Items can be removed from sale', route: '/pos', testing_guidance: 'Remove items. Cart updates.', priority: 'high', sort_order: 4, qa_test_results: [{ status: 'pass' }] },
  { id: 'p5', category_id: '11111111-1111-1111-1111-111111111105', title: 'Apply discounts', description: 'Percentage and fixed discounts', route: '/pos', testing_guidance: 'Apply discounts. Verify calculations.', priority: 'high', sort_order: 5, qa_test_results: [{ status: 'fail', notes: 'Percentage discount calculation off by 1 cent' }] },
  { id: 'p6', category_id: '11111111-1111-1111-1111-111111111105', title: 'Cash payment flow', description: 'Complete cash payment', route: '/pos', testing_guidance: 'Enter cash amount. Complete sale.', priority: 'critical', sort_order: 6, qa_test_results: [{ status: 'pass' }] },
  { id: 'p7', category_id: '11111111-1111-1111-1111-111111111105', title: 'Card payment flow', description: 'Complete card payment', route: '/pos', testing_guidance: 'Process card payment.', priority: 'critical', sort_order: 7, qa_test_results: [{ status: 'pass' }] },
  { id: 'p8', category_id: '11111111-1111-1111-1111-111111111105', title: 'Split payment', description: 'Pay with multiple methods', route: '/pos', testing_guidance: 'Part cash, part card.', priority: 'medium', sort_order: 8, qa_test_results: [{ status: 'pending' }] },
  { id: 'p9', category_id: '11111111-1111-1111-1111-111111111105', title: 'Receipt prints/emails', description: 'Receipt can be printed or emailed', route: '/pos', testing_guidance: 'Complete sale. Print receipt.', priority: 'high', sort_order: 9, qa_test_results: [{ status: 'pass' }] },
  { id: 'p10', category_id: '11111111-1111-1111-1111-111111111105', title: 'Customer lookup in POS', description: 'Find and attach customer to sale', route: '/pos', testing_guidance: 'Search customer. Attach to sale.', priority: 'high', sort_order: 10, qa_test_results: [{ status: 'pass' }] },
  { id: 'p11', category_id: '11111111-1111-1111-1111-111111111105', title: 'Barcode scanner works', description: 'Scan products by barcode', route: '/pos', testing_guidance: 'Scan product barcode.', priority: 'medium', sort_order: 11, qa_test_results: [{ status: 'pending' }] },
  { id: 'p12', category_id: '11111111-1111-1111-1111-111111111105', title: 'Layby creation', description: 'Create layby from POS', route: '/pos', testing_guidance: 'Create layby. Set deposit.', priority: 'medium', sort_order: 12, qa_test_results: [{ status: 'pending' }] },

  // Other categories with sample items
  { id: 'b1', category_id: '11111111-1111-1111-1111-111111111104', title: 'Create bespoke order', description: 'Full bespoke order creation', route: '/bespoke/new', testing_guidance: 'Create bespoke with customer, design details, pricing.', priority: 'critical', sort_order: 1, qa_test_results: [{ status: 'pass' }] },
  { id: 'b2', category_id: '11111111-1111-1111-1111-111111111104', title: 'Bespoke status flow', description: 'Move through bespoke stages', route: '/bespoke/[id]', testing_guidance: 'Progress: Quote → Design → Approved → Complete.', priority: 'critical', sort_order: 2, qa_test_results: [{ status: 'pass' }] },
  
  { id: 'i1', category_id: '11111111-1111-1111-1111-111111111106', title: 'View inventory list', description: 'Inventory list loads with products', route: '/inventory', testing_guidance: 'View inventory. Products display.', priority: 'critical', sort_order: 1, qa_test_results: [{ status: 'pass' }] },
  { id: 'i2', category_id: '11111111-1111-1111-1111-111111111106', title: 'Create new product', description: 'Add new inventory item', route: '/inventory/new', testing_guidance: 'Create product with all fields.', priority: 'critical', sort_order: 2, qa_test_results: [{ status: 'pass' }] },
  
  { id: 'c1', category_id: '11111111-1111-1111-1111-111111111107', title: 'View customer list', description: 'Customer list loads correctly', route: '/customers', testing_guidance: 'Open customers. List renders.', priority: 'critical', sort_order: 1, qa_test_results: [{ status: 'pass' }] },
  { id: 'c2', category_id: '11111111-1111-1111-1111-111111111107', title: 'Create new customer', description: 'Add new customer profile', route: '/customers/new', testing_guidance: 'Create customer with all details.', priority: 'critical', sort_order: 2, qa_test_results: [{ status: 'pass' }] },

  { id: 'inv1', category_id: '11111111-1111-1111-1111-111111111108', title: 'Create invoice', description: 'Generate new invoice', route: '/invoices/new', testing_guidance: 'Create invoice with line items.', priority: 'critical', sort_order: 1, qa_test_results: [{ status: 'pass' }] },
  { id: 'inv2', category_id: '11111111-1111-1111-1111-111111111108', title: 'Invoice PDF generation', description: 'PDF downloads correctly', route: '/invoices/[id]', testing_guidance: 'Generate PDF.', priority: 'critical', sort_order: 2, qa_test_results: [{ status: 'pass' }] },

  { id: 'f1', category_id: '11111111-1111-1111-1111-111111111109', title: 'Financials dashboard loads', description: 'Financial overview displays', route: '/financials', testing_guidance: 'Page loads. Charts render.', priority: 'critical', sort_order: 1, qa_test_results: [{ status: 'pass' }] },
  { id: 'f2', category_id: '11111111-1111-1111-1111-111111111109', title: 'EOD reconciliation', description: 'End of day cash-up process', route: '/eod', testing_guidance: 'Complete EOD.', priority: 'critical', sort_order: 4, qa_test_results: [{ status: 'pending' }] },

  { id: 's1', category_id: '11111111-1111-1111-1111-111111111110', title: 'Business settings save', description: 'Update business details', route: '/settings', testing_guidance: 'Edit business name, address.', priority: 'critical', sort_order: 1, qa_test_results: [{ status: 'pass' }] },
  { id: 's2', category_id: '11111111-1111-1111-1111-111111111110', title: 'Team management', description: 'Add/remove team members', route: '/settings/team', testing_guidance: 'Add user. Remove user.', priority: 'critical', sort_order: 2, qa_test_results: [{ status: 'pass' }] },

  { id: 'sec1', category_id: '11111111-1111-1111-1111-111111111118', title: 'Role-based access works', description: 'Permissions restrict access', route: '/dashboard', testing_guidance: 'Staff role cannot access admin.', priority: 'critical', sort_order: 1, qa_test_results: [{ status: 'pass' }] },
  { id: 'sec2', category_id: '11111111-1111-1111-1111-111111111118', title: 'Data isolation between tenants', description: 'Tenants cannot see each other', route: '/dashboard', testing_guidance: 'Tenant A cannot see Tenant B.', priority: 'critical', sort_order: 2, qa_test_results: [{ status: 'pass' }] },

  { id: 'bill1', category_id: '11111111-1111-1111-1111-111111111120', title: 'View current plan', description: 'Billing page shows plan details', route: '/billing', testing_guidance: 'Current plan shows.', priority: 'critical', sort_order: 1, qa_test_results: [{ status: 'pass' }] },
  { id: 'bill2', category_id: '11111111-1111-1111-1111-111111111120', title: 'Trial expiration handling', description: 'Trial end prompts upgrade', route: '/dashboard', testing_guidance: 'Trial expires. Prompted to subscribe.', priority: 'critical', sort_order: 5, qa_test_results: [{ status: 'fail', notes: 'Banner not showing for expired trials' }] },
];

export default async function QADashboardPage() {
  let categories: any[] = [];
  let items: any[] = [];
  let useMockData = false;

  try {
    const adminClient = createAdminClient();

    const { data: catData, error: catError } = await adminClient
      .from("qa_categories")
      .select("*")
      .order("sort_order");

    if (catError && catError.code === "42P01") {
      // Table doesn't exist, use mock data
      useMockData = true;
    } else {
      const { data: itemData } = await adminClient
        .from("qa_checklist_items")
        .select(`
          *,
          qa_test_results (*)
        `)
        .order("sort_order");

      categories = catData || [];
      items = itemData || [];
    }
  } catch (error) {
    logger.error("Failed to fetch QA data:", error);
    useMockData = true;
  }

  // Use mock data if database tables don't exist
  if (useMockData || categories.length === 0) {
    categories = mockCategories;
    items = mockItems;
  }

  // Group items by category
  const categorizedData = categories.map(cat => ({
    ...cat,
    items: items.filter(item => item.category_id === cat.id),
  }));

  // Calculate stats
  const allResults = items.flatMap(item => item.qa_test_results || []);
  const stats = {
    total: allResults.length,
    pass: allResults.filter(r => r.status === "pass").length,
    fail: allResults.filter(r => r.status === "fail").length,
    pending: allResults.filter(r => r.status === "pending").length,
    blocked: allResults.filter(r => r.status === "blocked").length,
  };
  const tested = stats.total - stats.pending - stats.blocked;
  const passRate = tested > 0 ? Math.round((stats.pass / tested) * 100) : 0;

  // Category breakdown
  const categoryStats = categorizedData.map(cat => {
    const catResults = cat.items.flatMap((item: any) => item.qa_test_results || []);
    const catTested = catResults.filter((r: any) => r.status !== "pending" && r.status !== "blocked").length;
    return {
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      total: catResults.length,
      pass: catResults.filter((r: any) => r.status === "pass").length,
      fail: catResults.filter((r: any) => r.status === "fail").length,
      pending: catResults.filter((r: any) => r.status === "pending").length,
      blocked: catResults.filter((r: any) => r.status === "blocked").length,
      passRate: catTested > 0 
        ? Math.round((catResults.filter((r: any) => r.status === "pass").length / catTested) * 100) 
        : 0,
    };
  });

  // Get critical/high priority failed items for launch blockers
  const launchBlockers = items
    .filter(item => {
      const result = item.qa_test_results?.[0];
      return (
        (item.priority === "critical" || item.priority === "high") &&
        result?.status === "fail"
      );
    })
    .map(item => ({
      ...item,
      categoryName: categories.find(c => c.id === item.category_id)?.name,
      result: item.qa_test_results[0],
    }));

  return (
    <QADashboardClient
      categories={categorizedData}
      stats={{ ...stats, passRate }}
      categoryStats={categoryStats}
      launchBlockers={launchBlockers}
    />
  );
}
