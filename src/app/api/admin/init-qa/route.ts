import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { isAllowlistedAdmin } from "@/lib/admin-allowlist";
import logger from "@/lib/logger";


import { withSentryFlush } from "@/lib/sentry-flush";

// POST /api/admin/init-qa - Initialize QA tables and seed data
// SECURITY: This is a super admin only endpoint
export const POST = withSentryFlush(async (request: NextRequest) => {
  try {
    // Rate-limit FIRST so we don't burn a super-admin DB lookup on
    // every probe. Pre-fix order was: auth + super-admin check first,
    // rate-limit second — meaning a denial-of-DB-roundtrips attacker
    // could spam the super_admins SELECT before being rate-limited.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "anonymous";
    const { success } = await checkRateLimit(`admin-init-qa:${ip}`);
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // SECURITY: Require authentication and super admin status
    const serverClient = await createServerClient();
    const { data: { user } } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Joey 2026-05-03 P2-H audit: pre-fix the gate was super_admins-only.
    // That's the same belt the (admin) layout uses, but G16 added a
    // belt-and-suspenders email allowlist on top because super_admins
    // could conceivably gain stale rows (G17 dropped teo@astry.agency
    // from super_admins specifically because of this risk). Pin this
    // admin-only QA-reset endpoint to the same dual gate.
    if (!isAllowlistedAdmin(user.email)) {
      return NextResponse.json({ error: "Forbidden - Platform admin access required" }, { status: 403 });
    }

    const adminClient = createAdminClient();
    const { data: superAdmin } = await adminClient
      .from("super_admins")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!superAdmin) {
      return NextResponse.json({ error: "Forbidden - Super admin access required" }, { status: 403 });
    }
    // Use pg_dump style connection via postgres protocol
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // QA Categories
    const categories = [
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

    // Check if table exists
    const { error: checkError } = await supabase.from("qa_categories").select("id").limit(1);
    
    if (checkError && checkError.code === "42P01") {
      return NextResponse.json({
        error: "Tables not created yet. Please run the SQL migration first.",
        instructions: "Go to Supabase Dashboard > SQL Editor and run the migration file."
      }, { status: 400 });
    }

    // Upsert categories
    const { error: catError } = await supabase
      .from("qa_categories")
      .upsert(categories, { onConflict: "id" });

    if (catError) {
      return NextResponse.json({ error: "Failed to insert categories", details: catError }, { status: 500 });
    }

    // QA Items - comprehensive list
    const items = [
      // Auth (8)
      { category_id: '11111111-1111-1111-1111-111111111101', title: 'User can sign up with email', description: 'New user registration with email and password', route: '/signup', testing_guidance: 'Create new account with valid email. Verify confirmation email is sent.', priority: 'critical', sort_order: 1 },
      { category_id: '11111111-1111-1111-1111-111111111101', title: 'User can log in', description: 'Existing user login with email/password', route: '/login', testing_guidance: 'Login with valid credentials. Check redirect to dashboard.', priority: 'critical', sort_order: 2 },
      { category_id: '11111111-1111-1111-1111-111111111101', title: 'Password reset flow works', description: 'Forgot password and reset flow', route: '/forgot-password', testing_guidance: 'Request password reset. Check email received. Reset password successfully.', priority: 'critical', sort_order: 3 },
      { category_id: '11111111-1111-1111-1111-111111111101', title: 'Onboarding wizard completes', description: 'New user onboarding steps', route: '/onboarding', testing_guidance: 'Complete all onboarding steps. Business name, settings, etc.', priority: 'high', sort_order: 4 },
      { category_id: '11111111-1111-1111-1111-111111111101', title: 'Session persists across refreshes', description: 'User stays logged in after page refresh', route: '/dashboard', testing_guidance: 'Login, refresh page, verify still logged in.', priority: 'high', sort_order: 5 },
      { category_id: '11111111-1111-1111-1111-111111111101', title: 'Logout works correctly', description: 'User can log out and session is cleared', route: '/dashboard', testing_guidance: 'Click logout. Verify redirected to login.', priority: 'high', sort_order: 6 },
      { category_id: '11111111-1111-1111-1111-111111111101', title: 'Invalid login shows error', description: 'Error message for wrong credentials', route: '/login', testing_guidance: 'Try invalid password. Should show clear error message.', priority: 'medium', sort_order: 7 },
      { category_id: '11111111-1111-1111-1111-111111111101', title: 'Team member invite works', description: 'Invite new team member via email', route: '/settings/team', testing_guidance: 'Send invite. Check email received.', priority: 'high', sort_order: 8 },
      
      // Dashboard (6)
      { category_id: '11111111-1111-1111-1111-111111111102', title: 'Dashboard loads with stats', description: 'Main dashboard shows key metrics', route: '/dashboard', testing_guidance: 'Dashboard shows revenue, orders, tasks summary.', priority: 'critical', sort_order: 1 },
      { category_id: '11111111-1111-1111-1111-111111111102', title: 'Sidebar navigation works', description: 'All sidebar links navigate correctly', route: '/dashboard', testing_guidance: 'Click each sidebar item. Verify correct page loads.', priority: 'critical', sort_order: 2 },
      { category_id: '11111111-1111-1111-1111-111111111102', title: 'Quick actions function', description: 'Dashboard quick action buttons work', route: '/dashboard', testing_guidance: 'Test New Repair, New Sale, New Customer buttons.', priority: 'high', sort_order: 3 },
      { category_id: '11111111-1111-1111-1111-111111111102', title: 'Recent activity shows', description: 'Dashboard shows recent transactions', route: '/dashboard', testing_guidance: 'Create activity. Verify it appears in recent section.', priority: 'medium', sort_order: 4 },
      { category_id: '11111111-1111-1111-1111-111111111102', title: 'Date range filter works', description: 'Dashboard date filters update data', route: '/dashboard', testing_guidance: 'Change date range. Verify stats update accordingly.', priority: 'medium', sort_order: 5 },
      { category_id: '11111111-1111-1111-1111-111111111102', title: 'Mobile sidebar toggle', description: 'Hamburger menu works on mobile', route: '/dashboard', testing_guidance: 'Test on mobile viewport. Sidebar opens/closes correctly.', priority: 'high', sort_order: 6 },

      // Repairs (9)
      { category_id: '11111111-1111-1111-1111-111111111103', title: 'Create new repair job', description: 'Full repair creation flow', route: '/repairs/new', testing_guidance: 'Create repair with customer, item details, pricing.', priority: 'critical', sort_order: 1 },
      { category_id: '11111111-1111-1111-1111-111111111103', title: 'Repair status transitions', description: 'Change repair status through lifecycle', route: '/repairs/[id]', testing_guidance: 'Move repair: Received → In Progress → Ready → Collected.', priority: 'critical', sort_order: 2 },
      { category_id: '11111111-1111-1111-1111-111111111103', title: 'Repair list filters work', description: 'Filter repairs by status, date, customer', route: '/repairs', testing_guidance: 'Apply various filters. Verify results match.', priority: 'high', sort_order: 3 },
      { category_id: '11111111-1111-1111-1111-111111111103', title: 'Repair PDF generates', description: 'Generate and download repair PDF', route: '/repairs/[id]', testing_guidance: 'Click PDF button. PDF downloads with correct info.', priority: 'high', sort_order: 4 },
      { category_id: '11111111-1111-1111-1111-111111111103', title: 'Repair photos upload', description: 'Upload before/after photos', route: '/repairs/[id]', testing_guidance: 'Upload images. Verify they display correctly.', priority: 'medium', sort_order: 5 },
      { category_id: '11111111-1111-1111-1111-111111111103', title: 'Workshop calendar view', description: 'Calendar shows scheduled repairs', route: '/workshop/calendar', testing_guidance: 'View calendar. Repairs appear on correct dates.', priority: 'medium', sort_order: 6 },
      { category_id: '11111111-1111-1111-1111-111111111103', title: 'Repair search works', description: 'Search repairs by reference or customer', route: '/repairs', testing_guidance: 'Search by job number, customer name.', priority: 'high', sort_order: 7 },
      { category_id: '11111111-1111-1111-1111-111111111103', title: 'Repair edit works', description: 'Edit existing repair details', route: '/repairs/[id]/edit', testing_guidance: 'Edit repair. Save changes. Verify updates persist.', priority: 'high', sort_order: 8 },
      { category_id: '11111111-1111-1111-1111-111111111103', title: 'Customer notification sends', description: 'Send ready-for-collection notification', route: '/repairs/[id]', testing_guidance: 'Mark ready. Send notification.', priority: 'high', sort_order: 9 },

      // Bespoke (6)
      { category_id: '11111111-1111-1111-1111-111111111104', title: 'Create bespoke order', description: 'Full bespoke order creation', route: '/bespoke/new', testing_guidance: 'Create bespoke with customer, design details, pricing.', priority: 'critical', sort_order: 1 },
      { category_id: '11111111-1111-1111-1111-111111111104', title: 'Bespoke status flow', description: 'Move through bespoke stages', route: '/bespoke/[id]', testing_guidance: 'Progress: Quote → Design → Approved → Complete.', priority: 'critical', sort_order: 2 },
      { category_id: '11111111-1111-1111-1111-111111111104', title: 'Design images upload', description: 'Upload design sketches/renders', route: '/bespoke/[id]', testing_guidance: 'Upload design images.', priority: 'high', sort_order: 3 },
      { category_id: '11111111-1111-1111-1111-111111111104', title: 'Customer approval works', description: 'Customer approves design via link', route: '/review/bespoke/[id]', testing_guidance: 'Send approval link. Customer can approve.', priority: 'high', sort_order: 4 },
      { category_id: '11111111-1111-1111-1111-111111111104', title: 'Deposit tracking', description: 'Track deposits on bespoke orders', route: '/bespoke/[id]', testing_guidance: 'Record deposit. Shows correctly on order.', priority: 'high', sort_order: 5 },
      { category_id: '11111111-1111-1111-1111-111111111104', title: 'Bespoke PDF quote', description: 'Generate PDF quote for bespoke', route: '/bespoke/[id]', testing_guidance: 'Generate PDF. Contains design, specs, pricing.', priority: 'medium', sort_order: 6 },

      // POS (12)
      { category_id: '11111111-1111-1111-1111-111111111105', title: 'POS loads correctly', description: 'POS interface loads without errors', route: '/pos', testing_guidance: 'Open POS. Interface renders.', priority: 'critical', sort_order: 1 },
      { category_id: '11111111-1111-1111-1111-111111111105', title: 'Add items to cart', description: 'Products can be added to sale', route: '/pos', testing_guidance: 'Click products. Items appear in cart.', priority: 'critical', sort_order: 2 },
      { category_id: '11111111-1111-1111-1111-111111111105', title: 'Quantity adjustments', description: 'Change item quantities in cart', route: '/pos', testing_guidance: 'Increase/decrease quantities.', priority: 'high', sort_order: 3 },
      { category_id: '11111111-1111-1111-1111-111111111105', title: 'Remove items from cart', description: 'Items can be removed from sale', route: '/pos', testing_guidance: 'Remove items. Cart updates.', priority: 'high', sort_order: 4 },
      { category_id: '11111111-1111-1111-1111-111111111105', title: 'Apply discounts', description: 'Percentage and fixed discounts', route: '/pos', testing_guidance: 'Apply discounts. Verify calculations.', priority: 'high', sort_order: 5 },
      { category_id: '11111111-1111-1111-1111-111111111105', title: 'Cash payment flow', description: 'Complete cash payment', route: '/pos', testing_guidance: 'Enter cash amount. Complete sale.', priority: 'critical', sort_order: 6 },
      { category_id: '11111111-1111-1111-1111-111111111105', title: 'Card payment flow', description: 'Complete card payment', route: '/pos', testing_guidance: 'Process card payment.', priority: 'critical', sort_order: 7 },
      { category_id: '11111111-1111-1111-1111-111111111105', title: 'Split payment', description: 'Pay with multiple methods', route: '/pos', testing_guidance: 'Part cash, part card.', priority: 'medium', sort_order: 8 },
      { category_id: '11111111-1111-1111-1111-111111111105', title: 'Receipt prints/emails', description: 'Receipt can be printed or emailed', route: '/pos', testing_guidance: 'Complete sale. Print receipt.', priority: 'high', sort_order: 9 },
      { category_id: '11111111-1111-1111-1111-111111111105', title: 'Customer lookup in POS', description: 'Find and attach customer to sale', route: '/pos', testing_guidance: 'Search customer. Attach to sale.', priority: 'high', sort_order: 10 },
      { category_id: '11111111-1111-1111-1111-111111111105', title: 'Barcode scanner works', description: 'Scan products by barcode', route: '/pos', testing_guidance: 'Scan product barcode.', priority: 'medium', sort_order: 11 },
      { category_id: '11111111-1111-1111-1111-111111111105', title: 'Layby creation', description: 'Create layby from POS', route: '/pos', testing_guidance: 'Create layby. Set deposit.', priority: 'medium', sort_order: 12 },

      // Inventory (10)
      { category_id: '11111111-1111-1111-1111-111111111106', title: 'View inventory list', description: 'Inventory list loads with products', route: '/inventory', testing_guidance: 'View inventory. Products display.', priority: 'critical', sort_order: 1 },
      { category_id: '11111111-1111-1111-1111-111111111106', title: 'Create new product', description: 'Add new inventory item', route: '/inventory/new', testing_guidance: 'Create product with all fields.', priority: 'critical', sort_order: 2 },
      { category_id: '11111111-1111-1111-1111-111111111106', title: 'Edit product details', description: 'Update existing product', route: '/inventory/[id]/edit', testing_guidance: 'Edit product. Save.', priority: 'high', sort_order: 3 },
      { category_id: '11111111-1111-1111-1111-111111111106', title: 'Stock level updates', description: 'Stock changes reflect correctly', route: '/inventory/[id]', testing_guidance: 'Adjust stock.', priority: 'high', sort_order: 4 },
      { category_id: '11111111-1111-1111-1111-111111111106', title: 'Low stock alerts', description: 'Products below threshold highlighted', route: '/inventory', testing_guidance: 'Set low stock threshold.', priority: 'medium', sort_order: 5 },
      { category_id: '11111111-1111-1111-1111-111111111106', title: 'Category filtering', description: 'Filter by product category', route: '/inventory', testing_guidance: 'Select category filter.', priority: 'medium', sort_order: 6 },
      { category_id: '11111111-1111-1111-1111-111111111106', title: 'Product search', description: 'Search products by name/SKU', route: '/inventory', testing_guidance: 'Search by various terms.', priority: 'high', sort_order: 7 },
      { category_id: '11111111-1111-1111-1111-111111111106', title: 'Stock transfer between locations', description: 'Transfer stock between stores', route: '/inventory/transfers', testing_guidance: 'Create transfer.', priority: 'high', sort_order: 8 },
      { category_id: '11111111-1111-1111-1111-111111111106', title: 'Stocktake functionality', description: 'Conduct stocktake and reconcile', route: '/stocktakes', testing_guidance: 'Start stocktake.', priority: 'medium', sort_order: 9 },
      { category_id: '11111111-1111-1111-1111-111111111106', title: 'Product images', description: 'Upload and display product images', route: '/inventory/[id]', testing_guidance: 'Upload image.', priority: 'low', sort_order: 10 },

      // Customers (8)
      { category_id: '11111111-1111-1111-1111-111111111107', title: 'View customer list', description: 'Customer list loads correctly', route: '/customers', testing_guidance: 'Open customers. List renders.', priority: 'critical', sort_order: 1 },
      { category_id: '11111111-1111-1111-1111-111111111107', title: 'Create new customer', description: 'Add new customer profile', route: '/customers/new', testing_guidance: 'Create customer with all details.', priority: 'critical', sort_order: 2 },
      { category_id: '11111111-1111-1111-1111-111111111107', title: 'View customer profile', description: 'Customer detail page shows history', route: '/customers/[id]', testing_guidance: 'View customer.', priority: 'high', sort_order: 3 },
      { category_id: '11111111-1111-1111-1111-111111111107', title: 'Edit customer details', description: 'Update customer information', route: '/customers/[id]/edit', testing_guidance: 'Edit customer.', priority: 'high', sort_order: 4 },
      { category_id: '11111111-1111-1111-1111-111111111107', title: 'Customer search', description: 'Search by name, email, phone', route: '/customers', testing_guidance: 'Search various terms.', priority: 'high', sort_order: 5 },
      { category_id: '11111111-1111-1111-1111-111111111107', title: 'Customer transaction history', description: 'View all customer transactions', route: '/customers/[id]', testing_guidance: 'All sales, repairs show in history.', priority: 'medium', sort_order: 6 },
      { category_id: '11111111-1111-1111-1111-111111111107', title: 'Customer notes', description: 'Add notes to customer profile', route: '/customers/[id]', testing_guidance: 'Add note.', priority: 'low', sort_order: 7 },
      { category_id: '11111111-1111-1111-1111-111111111107', title: 'Duplicate customer detection', description: 'Warning for potential duplicates', route: '/customers/new', testing_guidance: 'Create similar customer.', priority: 'medium', sort_order: 8 },

      // Invoices (7)
      { category_id: '11111111-1111-1111-1111-111111111108', title: 'Create invoice', description: 'Generate new invoice', route: '/invoices/new', testing_guidance: 'Create invoice with line items.', priority: 'critical', sort_order: 1 },
      { category_id: '11111111-1111-1111-1111-111111111108', title: 'Invoice PDF generation', description: 'PDF downloads correctly', route: '/invoices/[id]', testing_guidance: 'Generate PDF.', priority: 'critical', sort_order: 2 },
      { category_id: '11111111-1111-1111-1111-111111111108', title: 'Email invoice', description: 'Send invoice via email', route: '/invoices/[id]', testing_guidance: 'Email invoice.', priority: 'high', sort_order: 3 },
      { category_id: '11111111-1111-1111-1111-111111111108', title: 'Mark invoice paid', description: 'Record payment on invoice', route: '/invoices/[id]', testing_guidance: 'Mark paid.', priority: 'high', sort_order: 4 },
      { category_id: '11111111-1111-1111-1111-111111111108', title: 'Create quote', description: 'Generate quote for customer', route: '/quotes/new', testing_guidance: 'Create quote with items.', priority: 'high', sort_order: 5 },
      { category_id: '11111111-1111-1111-1111-111111111108', title: 'Convert quote to invoice', description: 'Transform quote to invoice', route: '/quotes/[id]', testing_guidance: 'Convert quote.', priority: 'high', sort_order: 6 },
      { category_id: '11111111-1111-1111-1111-111111111108', title: 'Invoice list filtering', description: 'Filter by status, date, customer', route: '/invoices', testing_guidance: 'Apply filters.', priority: 'medium', sort_order: 7 },

      // Financial (6)
      { category_id: '11111111-1111-1111-1111-111111111109', title: 'Financials dashboard loads', description: 'Financial overview displays', route: '/financials', testing_guidance: 'Page loads. Charts render.', priority: 'critical', sort_order: 1 },
      { category_id: '11111111-1111-1111-1111-111111111109', title: 'Revenue by category', description: 'Revenue breakdown by type', route: '/financials', testing_guidance: 'Category breakdown shows.', priority: 'high', sort_order: 2 },
      { category_id: '11111111-1111-1111-1111-111111111109', title: 'Date range filtering', description: 'Filter reports by date range', route: '/financials', testing_guidance: 'Change dates.', priority: 'high', sort_order: 3 },
      { category_id: '11111111-1111-1111-1111-111111111109', title: 'EOD reconciliation', description: 'End of day cash-up process', route: '/eod', testing_guidance: 'Complete EOD.', priority: 'critical', sort_order: 4 },
      { category_id: '11111111-1111-1111-1111-111111111109', title: 'Expense tracking', description: 'Record and view expenses', route: '/expenses', testing_guidance: 'Add expense.', priority: 'high', sort_order: 5 },
      { category_id: '11111111-1111-1111-1111-111111111109', title: 'Export reports', description: 'Export financial data', route: '/financials', testing_guidance: 'Export CSV/PDF.', priority: 'medium', sort_order: 6 },

      // Settings (7)
      { category_id: '11111111-1111-1111-1111-111111111110', title: 'Business settings save', description: 'Update business details', route: '/settings', testing_guidance: 'Edit business name, address.', priority: 'critical', sort_order: 1 },
      { category_id: '11111111-1111-1111-1111-111111111110', title: 'Team management', description: 'Add/remove team members', route: '/settings/team', testing_guidance: 'Add user. Remove user.', priority: 'critical', sort_order: 2 },
      { category_id: '11111111-1111-1111-1111-111111111110', title: 'Role permissions', description: 'Configure role permissions', route: '/settings/team/permissions', testing_guidance: 'Edit role.', priority: 'high', sort_order: 3 },
      { category_id: '11111111-1111-1111-1111-111111111110', title: 'Location management', description: 'Add/edit store locations', route: '/settings/locations', testing_guidance: 'Add location.', priority: 'high', sort_order: 4 },
      { category_id: '11111111-1111-1111-1111-111111111110', title: 'Notification settings', description: 'Configure notification preferences', route: '/settings/notifications', testing_guidance: 'Toggle notifications.', priority: 'medium', sort_order: 5 },
      { category_id: '11111111-1111-1111-1111-111111111110', title: 'Document numbering', description: 'Configure invoice/repair numbering', route: '/settings/numbering', testing_guidance: 'Set prefix/format.', priority: 'medium', sort_order: 6 },
      { category_id: '11111111-1111-1111-1111-111111111110', title: 'Email templates', description: 'Customize email templates', route: '/settings/email', testing_guidance: 'Edit template.', priority: 'medium', sort_order: 7 },

      // Marketing (6)
      { category_id: '11111111-1111-1111-1111-111111111111', title: 'Campaign creation', description: 'Create email campaign', route: '/marketing/campaigns/new', testing_guidance: 'Create campaign.', priority: 'high', sort_order: 1 },
      { category_id: '11111111-1111-1111-1111-111111111111', title: 'Bulk email sending', description: 'Send bulk emails', route: '/marketing/bulk-email', testing_guidance: 'Compose email. Send.', priority: 'high', sort_order: 2 },
      { category_id: '11111111-1111-1111-1111-111111111111', title: 'SMS campaigns', description: 'Send SMS campaigns', route: '/marketing/bulk-sms', testing_guidance: 'Create SMS. Send.', priority: 'medium', sort_order: 3 },
      { category_id: '11111111-1111-1111-1111-111111111111', title: 'WhatsApp campaigns', description: 'WhatsApp message campaigns', route: '/marketing/whatsapp-campaigns', testing_guidance: 'Send WhatsApp campaign.', priority: 'medium', sort_order: 4 },
      { category_id: '11111111-1111-1111-1111-111111111111', title: 'Customer segments', description: 'Create customer segments', route: '/marketing/segments', testing_guidance: 'Create segment.', priority: 'medium', sort_order: 5 },
      { category_id: '11111111-1111-1111-1111-111111111111', title: 'Marketing analytics', description: 'View campaign performance', route: '/marketing/analytics', testing_guidance: 'See open rates, clicks.', priority: 'low', sort_order: 6 },

      // Migration (6)
      { category_id: '11111111-1111-1111-1111-111111111112', title: 'File upload works', description: 'Upload Excel/CSV files', route: '/migration/new', testing_guidance: 'Upload file.', priority: 'critical', sort_order: 1 },
      { category_id: '11111111-1111-1111-1111-111111111112', title: 'Data preview shows', description: 'Preview uploaded data before import', route: '/migration/[id]/preview', testing_guidance: 'See parsed data.', priority: 'critical', sort_order: 2 },
      { category_id: '11111111-1111-1111-1111-111111111112', title: 'Field mapping works', description: 'Map columns to system fields', route: '/migration/[id]/mapping', testing_guidance: 'Map all required fields.', priority: 'high', sort_order: 3 },
      { category_id: '11111111-1111-1111-1111-111111111112', title: 'Duplicate detection', description: 'Identify potential duplicates', route: '/migration/[id]/duplicates', testing_guidance: 'Duplicates flagged.', priority: 'high', sort_order: 4 },
      { category_id: '11111111-1111-1111-1111-111111111112', title: 'Migration execution', description: 'Run data import', route: '/migration/[id]/execute', testing_guidance: 'Execute import.', priority: 'critical', sort_order: 5 },
      { category_id: '11111111-1111-1111-1111-111111111112', title: 'Migration results', description: 'View import results', route: '/migration/[id]/results', testing_guidance: 'Success/error counts show.', priority: 'high', sort_order: 6 },

      // Appraisals (5)
      { category_id: '11111111-1111-1111-1111-111111111113', title: 'Create appraisal', description: 'New jewelry appraisal', route: '/appraisals/new', testing_guidance: 'Create appraisal.', priority: 'high', sort_order: 1 },
      { category_id: '11111111-1111-1111-1111-111111111113', title: 'Appraisal PDF', description: 'Generate appraisal certificate', route: '/appraisals/[id]', testing_guidance: 'PDF generates.', priority: 'high', sort_order: 2 },
      { category_id: '11111111-1111-1111-1111-111111111113', title: 'Digital passport creation', description: 'Create jewelry passport', route: '/passports/new', testing_guidance: 'Create passport.', priority: 'high', sort_order: 3 },
      { category_id: '11111111-1111-1111-1111-111111111113', title: 'Passport QR code', description: 'QR code links to passport', route: '/passports/[id]', testing_guidance: 'QR scans.', priority: 'medium', sort_order: 4 },
      { category_id: '11111111-1111-1111-1111-111111111113', title: 'Public verification', description: 'Public can verify passport', route: '/verify/[uid]', testing_guidance: 'Public URL shows passport.', priority: 'high', sort_order: 5 },

      // Tasks (5)
      { category_id: '11111111-1111-1111-1111-111111111114', title: 'Create task', description: 'Add new task', route: '/tasks', testing_guidance: 'Create task.', priority: 'high', sort_order: 1 },
      { category_id: '11111111-1111-1111-1111-111111111114', title: 'Task list view', description: 'View all tasks', route: '/tasks', testing_guidance: 'Tasks show by status.', priority: 'high', sort_order: 2 },
      { category_id: '11111111-1111-1111-1111-111111111114', title: 'Complete task', description: 'Mark task complete', route: '/tasks/[id]', testing_guidance: 'Complete task.', priority: 'high', sort_order: 3 },
      { category_id: '11111111-1111-1111-1111-111111111114', title: 'Task due dates', description: 'Due date reminders work', route: '/tasks', testing_guidance: 'Overdue tasks highlighted.', priority: 'medium', sort_order: 4 },
      { category_id: '11111111-1111-1111-1111-111111111114', title: 'Task attachments', description: 'Add files to tasks', route: '/tasks/[id]', testing_guidance: 'Upload attachment.', priority: 'low', sort_order: 5 },

      // Integrations (5)
      { category_id: '11111111-1111-1111-1111-111111111115', title: 'Stripe Connect setup', description: 'Connect Stripe account', route: '/settings/integrations', testing_guidance: 'Complete Stripe onboarding.', priority: 'critical', sort_order: 1 },
      { category_id: '11111111-1111-1111-1111-111111111115', title: 'Xero integration', description: 'Connect Xero accounting', route: '/integrations/xero', testing_guidance: 'Connect Xero.', priority: 'high', sort_order: 2 },
      { category_id: '11111111-1111-1111-1111-111111111115', title: 'Google Calendar sync', description: 'Connect Google Calendar', route: '/integrations/google-calendar', testing_guidance: 'Connect calendar.', priority: 'medium', sort_order: 3 },
      { category_id: '11111111-1111-1111-1111-111111111115', title: 'WhatsApp integration', description: 'Connect WhatsApp Business', route: '/settings/integrations', testing_guidance: 'Connect WhatsApp.', priority: 'high', sort_order: 4 },
      { category_id: '11111111-1111-1111-1111-111111111115', title: 'Shopify integration', description: 'Connect Shopify store', route: '/integrations/shopify', testing_guidance: 'Connect Shopify.', priority: 'medium', sort_order: 5 },

      // Website (5)
      { category_id: '11111111-1111-1111-1111-111111111116', title: 'Shop page loads', description: 'Customer shop page works', route: '/[subdomain]', testing_guidance: 'Public shop loads.', priority: 'critical', sort_order: 1 },
      { category_id: '11111111-1111-1111-1111-111111111116', title: 'Appointment booking', description: 'Book appointment online', route: '/[subdomain]/appointments', testing_guidance: 'Select service, date, time.', priority: 'high', sort_order: 2 },
      { category_id: '11111111-1111-1111-1111-111111111116', title: 'Enquiry form', description: 'Submit enquiry via website', route: '/[subdomain]/enquiry', testing_guidance: 'Fill form. Submit.', priority: 'high', sort_order: 3 },
      { category_id: '11111111-1111-1111-1111-111111111116', title: 'Repair tracking', description: 'Customer tracks repair status', route: '/[subdomain]/track', testing_guidance: 'Enter reference.', priority: 'high', sort_order: 4 },
      { category_id: '11111111-1111-1111-1111-111111111116', title: 'Catalogue browsing', description: 'Browse product catalogue', route: '/[subdomain]/catalogue', testing_guidance: 'Products display.', priority: 'medium', sort_order: 5 },

      // Mobile (5)
      { category_id: '11111111-1111-1111-1111-111111111117', title: 'Dashboard mobile layout', description: 'Dashboard works on mobile', route: '/dashboard', testing_guidance: 'Layout adapts.', priority: 'high', sort_order: 1 },
      { category_id: '11111111-1111-1111-1111-111111111117', title: 'POS mobile usability', description: 'POS works on tablet', route: '/pos', testing_guidance: 'POS usable on iPad.', priority: 'high', sort_order: 2 },
      { category_id: '11111111-1111-1111-1111-111111111117', title: 'Forms work on mobile', description: 'Forms submit on mobile', route: 'Various', testing_guidance: 'Complete forms on mobile.', priority: 'high', sort_order: 3 },
      { category_id: '11111111-1111-1111-1111-111111111117', title: 'Tables scroll on mobile', description: 'Data tables scrollable', route: 'Various', testing_guidance: 'Tables horizontally scroll.', priority: 'medium', sort_order: 4 },
      { category_id: '11111111-1111-1111-1111-111111111117', title: 'Touch targets sized', description: 'Buttons large enough for touch', route: 'Various', testing_guidance: 'All elements easily tappable.', priority: 'medium', sort_order: 5 },

      // Security (5)
      { category_id: '11111111-1111-1111-1111-111111111118', title: 'Role-based access works', description: 'Permissions restrict access', route: '/dashboard', testing_guidance: 'Staff role cannot access admin.', priority: 'critical', sort_order: 1 },
      { category_id: '11111111-1111-1111-1111-111111111118', title: 'Data isolation between tenants', description: 'Tenants cannot see each other', route: '/dashboard', testing_guidance: 'Tenant A cannot see Tenant B.', priority: 'critical', sort_order: 2 },
      { category_id: '11111111-1111-1111-1111-111111111118', title: 'Session timeout', description: 'Inactive sessions expire', route: '/dashboard', testing_guidance: 'After timeout, requires re-login.', priority: 'high', sort_order: 3 },
      { category_id: '11111111-1111-1111-1111-111111111118', title: 'Audit log captures actions', description: 'Important actions logged', route: '/admin/audit', testing_guidance: 'Key actions appear in audit log.', priority: 'medium', sort_order: 4 },
      { category_id: '11111111-1111-1111-1111-111111111118', title: 'Secure password requirements', description: 'Weak passwords rejected', route: '/signup', testing_guidance: 'Simple passwords not accepted.', priority: 'high', sort_order: 5 },

      // Performance (5)
      { category_id: '11111111-1111-1111-1111-111111111119', title: 'Page load times acceptable', description: 'Pages load under 3 seconds', route: 'Various', testing_guidance: 'Key pages load quickly.', priority: 'high', sort_order: 1 },
      { category_id: '11111111-1111-1111-1111-111111111119', title: 'Error states handled', description: 'Errors show friendly messages', route: 'Various', testing_guidance: 'API errors show user-friendly message.', priority: 'high', sort_order: 2 },
      { category_id: '11111111-1111-1111-1111-111111111119', title: 'Empty states shown', description: 'Empty lists have helpful text', route: 'Various', testing_guidance: 'No data shows helpful empty state.', priority: 'medium', sort_order: 3 },
      { category_id: '11111111-1111-1111-1111-111111111119', title: 'Loading states present', description: 'Loading indicators during fetches', route: 'Various', testing_guidance: 'Data loading shows spinner.', priority: 'medium', sort_order: 4 },
      { category_id: '11111111-1111-1111-1111-111111111119', title: 'Form validation works', description: 'Invalid input shows errors', route: 'Various', testing_guidance: 'Required fields validated.', priority: 'high', sort_order: 5 },

      // Billing (6)
      { category_id: '11111111-1111-1111-1111-111111111120', title: 'View current plan', description: 'Billing page shows plan details', route: '/billing', testing_guidance: 'Current plan shows.', priority: 'critical', sort_order: 1 },
      { category_id: '11111111-1111-1111-1111-111111111120', title: 'Upgrade plan', description: 'Can upgrade subscription', route: '/billing', testing_guidance: 'Upgrade flow works.', priority: 'critical', sort_order: 2 },
      { category_id: '11111111-1111-1111-1111-111111111120', title: 'Payment method update', description: 'Update credit card', route: '/billing', testing_guidance: 'Add new card.', priority: 'high', sort_order: 3 },
      { category_id: '11111111-1111-1111-1111-111111111120', title: 'Invoice history', description: 'View past invoices', route: '/billing', testing_guidance: 'Past invoices list.', priority: 'medium', sort_order: 4 },
      { category_id: '11111111-1111-1111-1111-111111111120', title: 'Trial expiration handling', description: 'Trial end prompts upgrade', route: '/dashboard', testing_guidance: 'Trial expires. Prompted to subscribe.', priority: 'critical', sort_order: 5 },
      { category_id: '11111111-1111-1111-1111-111111111120', title: 'Subscription cancellation', description: 'Can cancel subscription', route: '/billing', testing_guidance: 'Cancel flow works.', priority: 'high', sort_order: 6 },
    ];

    // Joey 2026-05-03 P2-H audit: pre-fix the upsert had no `onConflict`
    // target, so every call to this endpoint INSERTED a fresh copy of
    // every item — running it twice doubled the table, three times
    // tripled it. The right shape: this is a one-shot seed, refuse to
    // run if items already exist. Caller can manually clear
    // qa_checklist_items if a re-seed is intentional.
    const { count: existingCount } = await supabase
      .from("qa_checklist_items")
      .select("*", { count: "exact", head: true });
    if ((existingCount ?? 0) > 0) {
      return NextResponse.json({
        success: false,
        message: `qa_checklist_items already has ${existingCount} rows; refusing to seed again. TRUNCATE qa_checklist_items first if a re-seed is intentional.`,
        items_existing: existingCount,
        categories: categories.length,
      }, { status: 409 });
    }

    const { data: insertedItems, error: itemError } = await supabase
      .from("qa_checklist_items")
      .insert(items.map((item) => ({ ...item, id: undefined })))
      .select("id");

    if (itemError) {
      return NextResponse.json({ error: "Failed to insert items", details: itemError }, { status: 500 });
    }

    // Create test results for each item
    if (insertedItems && insertedItems.length > 0) {
      const results = insertedItems.map(item => ({
        checklist_item_id: item.id,
        status: "pending",
      }));

      await supabase.from("qa_test_results").upsert(results, { onConflict: "checklist_item_id" });
    }

    return NextResponse.json({
      success: true,
      categories: categories.length,
      items: items.length,
    });

  } catch (error) {
    logger.error("Init QA error:", error);
    return NextResponse.json({ error: "Failed to initialize QA", details: String(error) }, { status: 500 });
  }
});
