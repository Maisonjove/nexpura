-- QA Checklist System for Internal Testing
-- Created: 2026-03-21

-- QA Categories table
CREATE TABLE IF NOT EXISTS qa_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- QA Checklist Items table
CREATE TABLE IF NOT EXISTS qa_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES qa_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  route TEXT,
  testing_guidance TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- QA Test Results table
CREATE TABLE IF NOT EXISTS qa_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id UUID REFERENCES qa_checklist_items(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pass', 'fail', 'pending', 'blocked')),
  notes TEXT,
  screenshot_url TEXT,
  tester_name TEXT,
  tester_email TEXT,
  tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_qa_items_category ON qa_checklist_items(category_id);
CREATE INDEX IF NOT EXISTS idx_qa_results_item ON qa_test_results(checklist_item_id);
CREATE INDEX IF NOT EXISTS idx_qa_results_status ON qa_test_results(status);
CREATE INDEX IF NOT EXISTS idx_qa_items_priority ON qa_checklist_items(priority);

-- Enable RLS but allow all access for now (internal tool)
ALTER TABLE qa_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_test_results ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for authenticated users
CREATE POLICY "qa_categories_all" ON qa_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "qa_checklist_items_all" ON qa_checklist_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "qa_test_results_all" ON qa_test_results FOR ALL USING (true) WITH CHECK (true);

-- Insert QA Categories
INSERT INTO qa_categories (id, name, description, icon, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Authentication & Onboarding', 'User registration, login, password reset, onboarding flows', 'shield', 1),
  ('11111111-1111-1111-1111-111111111102', 'Dashboard & Navigation', 'Main dashboard, sidebar navigation, quick actions', 'layout', 2),
  ('11111111-1111-1111-1111-111111111103', 'Repairs & Workshop', 'Repair jobs, workshop management, job lifecycle', 'wrench', 3),
  ('11111111-1111-1111-1111-111111111104', 'Bespoke Orders', 'Custom jewelry orders, design process, approvals', 'gem', 4),
  ('11111111-1111-1111-1111-111111111105', 'Point of Sale', 'POS terminal, checkout, payments, receipts', 'shopping-cart', 5),
  ('11111111-1111-1111-1111-111111111106', 'Inventory Management', 'Stock levels, products, categories, transfers', 'package', 6),
  ('11111111-1111-1111-1111-111111111107', 'Customer Management', 'Customer profiles, history, communications', 'users', 7),
  ('11111111-1111-1111-1111-111111111108', 'Invoices & Quotes', 'Invoice creation, quotes, PDF generation', 'file-text', 8),
  ('11111111-1111-1111-1111-111111111109', 'Financial Reports', 'Revenue reports, EOD reconciliation, expenses', 'trending-up', 9),
  ('11111111-1111-1111-1111-111111111110', 'Settings & Configuration', 'Business settings, team, roles, integrations', 'settings', 10),
  ('11111111-1111-1111-1111-111111111111', 'Marketing & Campaigns', 'Email campaigns, SMS, WhatsApp, analytics', 'megaphone', 11),
  ('11111111-1111-1111-1111-111111111112', 'Data Migration', 'Import tools, file uploads, mapping, execution', 'upload', 12),
  ('11111111-1111-1111-1111-111111111113', 'Appraisals & Passports', 'Jewelry appraisals, digital passports, certificates', 'award', 13),
  ('11111111-1111-1111-1111-111111111114', 'Tasks & Workflow', 'Task management, assignments, notifications', 'check-square', 14),
  ('11111111-1111-1111-1111-111111111115', 'Integrations', 'Stripe, Xero, Google Calendar, WhatsApp, Shopify', 'plug', 15),
  ('11111111-1111-1111-1111-111111111116', 'Customer-Facing Website', 'Shop pages, appointments, enquiries, tracking', 'globe', 16),
  ('11111111-1111-1111-1111-111111111117', 'Mobile & Responsiveness', 'Mobile layouts, touch interactions, PWA', 'smartphone', 17),
  ('11111111-1111-1111-1111-111111111118', 'Security & Permissions', 'Role-based access, data protection, audit logs', 'lock', 18),
  ('11111111-1111-1111-1111-111111111119', 'Performance & Reliability', 'Load times, error handling, edge cases', 'zap', 19),
  ('11111111-1111-1111-1111-111111111120', 'Billing & Subscriptions', 'Plan management, payments, Stripe billing', 'credit-card', 20);

-- Insert QA Checklist Items (100+ items across categories)

-- Authentication & Onboarding (Category 1)
INSERT INTO qa_checklist_items (category_id, title, description, route, testing_guidance, priority, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111101', 'User can sign up with email', 'New user registration with email and password', '/signup', 'Create new account with valid email. Verify confirmation email is sent.', 'critical', 1),
  ('11111111-1111-1111-1111-111111111101', 'User can log in', 'Existing user login with email/password', '/login', 'Login with valid credentials. Check redirect to dashboard.', 'critical', 2),
  ('11111111-1111-1111-1111-111111111101', 'Password reset flow works', 'Forgot password and reset flow', '/forgot-password', 'Request password reset. Check email received. Reset password successfully.', 'critical', 3),
  ('11111111-1111-1111-1111-111111111101', 'Onboarding wizard completes', 'New user onboarding steps', '/onboarding', 'Complete all onboarding steps. Business name, settings, etc.', 'high', 4),
  ('11111111-1111-1111-1111-111111111101', 'Session persists across refreshes', 'User stays logged in after page refresh', '/dashboard', 'Login, refresh page, verify still logged in.', 'high', 5),
  ('11111111-1111-1111-1111-111111111101', 'Logout works correctly', 'User can log out and session is cleared', '/dashboard', 'Click logout. Verify redirected to login. Cannot access protected routes.', 'high', 6),
  ('11111111-1111-1111-1111-111111111101', 'Invalid login shows error', 'Error message for wrong credentials', '/login', 'Try invalid password. Should show clear error message.', 'medium', 7),
  ('11111111-1111-1111-1111-111111111101', 'Team member invite works', 'Invite new team member via email', '/settings/team', 'Send invite. Check email received. Accept invite and create account.', 'high', 8),

-- Dashboard & Navigation (Category 2)
  ('11111111-1111-1111-1111-111111111102', 'Dashboard loads with stats', 'Main dashboard shows key metrics', '/dashboard', 'Dashboard shows revenue, orders, tasks summary. No errors.', 'critical', 1),
  ('11111111-1111-1111-1111-111111111102', 'Sidebar navigation works', 'All sidebar links navigate correctly', '/dashboard', 'Click each sidebar item. Verify correct page loads.', 'critical', 2),
  ('11111111-1111-1111-1111-111111111102', 'Quick actions function', 'Dashboard quick action buttons work', '/dashboard', 'Test New Repair, New Sale, New Customer buttons.', 'high', 3),
  ('11111111-1111-1111-1111-111111111102', 'Recent activity shows', 'Dashboard shows recent transactions', '/dashboard', 'Create activity. Verify it appears in recent section.', 'medium', 4),
  ('11111111-1111-1111-1111-111111111102', 'Date range filter works', 'Dashboard date filters update data', '/dashboard', 'Change date range. Verify stats update accordingly.', 'medium', 5),
  ('11111111-1111-1111-1111-111111111102', 'Mobile sidebar toggle', 'Hamburger menu works on mobile', '/dashboard', 'Test on mobile viewport. Sidebar opens/closes correctly.', 'high', 6),

-- Repairs & Workshop (Category 3)
  ('11111111-1111-1111-1111-111111111103', 'Create new repair job', 'Full repair creation flow', '/repairs/new', 'Create repair with customer, item details, pricing. Save successfully.', 'critical', 1),
  ('11111111-1111-1111-1111-111111111103', 'Repair status transitions', 'Change repair status through lifecycle', '/repairs/[id]', 'Move repair: Received → In Progress → Ready → Collected.', 'critical', 2),
  ('11111111-1111-1111-1111-111111111103', 'Repair list filters work', 'Filter repairs by status, date, customer', '/repairs', 'Apply various filters. Verify results match.', 'high', 3),
  ('11111111-1111-1111-1111-111111111103', 'Repair PDF generates', 'Generate and download repair PDF', '/repairs/[id]', 'Click PDF button. PDF downloads with correct info.', 'high', 4),
  ('11111111-1111-1111-1111-111111111103', 'Repair photos upload', 'Upload before/after photos', '/repairs/[id]', 'Upload images. Verify they display correctly.', 'medium', 5),
  ('11111111-1111-1111-1111-111111111103', 'Workshop calendar view', 'Calendar shows scheduled repairs', '/workshop/calendar', 'View calendar. Repairs appear on correct dates.', 'medium', 6),
  ('11111111-1111-1111-1111-111111111103', 'Repair search works', 'Search repairs by reference or customer', '/repairs', 'Search by job number, customer name. Verify results.', 'high', 7),
  ('11111111-1111-1111-1111-111111111103', 'Repair edit works', 'Edit existing repair details', '/repairs/[id]/edit', 'Edit repair. Save changes. Verify updates persist.', 'high', 8),
  ('11111111-1111-1111-1111-111111111103', 'Customer notification sends', 'Send ready-for-collection notification', '/repairs/[id]', 'Mark ready. Send notification. Verify customer receives.', 'high', 9),

-- Bespoke Orders (Category 4)
  ('11111111-1111-1111-1111-111111111104', 'Create bespoke order', 'Full bespoke order creation', '/bespoke/new', 'Create bespoke with customer, design details, pricing.', 'critical', 1),
  ('11111111-1111-1111-1111-111111111104', 'Bespoke status flow', 'Move through bespoke stages', '/bespoke/[id]', 'Progress: Quote → Design → Approved → In Production → Complete.', 'critical', 2),
  ('11111111-1111-1111-1111-111111111104', 'Design images upload', 'Upload design sketches/renders', '/bespoke/[id]', 'Upload design images. Customer can view in portal.', 'high', 3),
  ('11111111-1111-1111-1111-111111111104', 'Customer approval works', 'Customer approves design via link', '/review/bespoke/[id]', 'Send approval link. Customer can approve/request changes.', 'high', 4),
  ('11111111-1111-1111-1111-111111111104', 'Deposit tracking', 'Track deposits on bespoke orders', '/bespoke/[id]', 'Record deposit. Shows correctly on order.', 'high', 5),
  ('11111111-1111-1111-1111-111111111104', 'Bespoke PDF quote', 'Generate PDF quote for bespoke', '/bespoke/[id]', 'Generate PDF. Contains design, specs, pricing.', 'medium', 6),

-- Point of Sale (Category 5)
  ('11111111-1111-1111-1111-111111111105', 'POS loads correctly', 'POS interface loads without errors', '/pos', 'Open POS. Interface renders. Products load.', 'critical', 1),
  ('11111111-1111-1111-1111-111111111105', 'Add items to cart', 'Products can be added to sale', '/pos', 'Click products. Items appear in cart with correct prices.', 'critical', 2),
  ('11111111-1111-1111-1111-111111111105', 'Quantity adjustments', 'Change item quantities in cart', '/pos', 'Increase/decrease quantities. Totals update correctly.', 'high', 3),
  ('11111111-1111-1111-1111-111111111105', 'Remove items from cart', 'Items can be removed from sale', '/pos', 'Remove items. Cart updates. Total recalculates.', 'high', 4),
  ('11111111-1111-1111-1111-111111111105', 'Apply discounts', 'Percentage and fixed discounts', '/pos', 'Apply 10% discount. Apply $20 discount. Verify calculations.', 'high', 5),
  ('11111111-1111-1111-1111-111111111105', 'Cash payment flow', 'Complete cash payment', '/pos', 'Enter cash amount. Calculate change. Complete sale.', 'critical', 6),
  ('11111111-1111-1111-1111-111111111105', 'Card payment flow', 'Complete card payment', '/pos', 'Process card payment. Receipt generates.', 'critical', 7),
  ('11111111-1111-1111-1111-111111111105', 'Split payment', 'Pay with multiple methods', '/pos', 'Part cash, part card. Both recorded correctly.', 'medium', 8),
  ('11111111-1111-1111-1111-111111111105', 'Receipt prints/emails', 'Receipt can be printed or emailed', '/pos', 'Complete sale. Print receipt. Email receipt.', 'high', 9),
  ('11111111-1111-1111-1111-111111111105', 'Customer lookup in POS', 'Find and attach customer to sale', '/pos', 'Search customer. Attach to sale. Shows in history.', 'high', 10),
  ('11111111-1111-1111-1111-111111111105', 'Barcode scanner works', 'Scan products by barcode', '/pos', 'Scan product barcode. Item adds to cart.', 'medium', 11),
  ('11111111-1111-1111-1111-111111111105', 'Layby creation', 'Create layby from POS', '/pos', 'Create layby. Set deposit. Payment schedule shows.', 'medium', 12),

-- Inventory Management (Category 6)
  ('11111111-1111-1111-1111-111111111106', 'View inventory list', 'Inventory list loads with products', '/inventory', 'View inventory. Products display with stock levels.', 'critical', 1),
  ('11111111-1111-1111-1111-111111111106', 'Create new product', 'Add new inventory item', '/inventory/new', 'Create product with all fields. Saves correctly.', 'critical', 2),
  ('11111111-1111-1111-1111-111111111106', 'Edit product details', 'Update existing product', '/inventory/[id]/edit', 'Edit product. Save. Changes persist.', 'high', 3),
  ('11111111-1111-1111-1111-111111111106', 'Stock level updates', 'Stock changes reflect correctly', '/inventory/[id]', 'Adjust stock. View history. Numbers correct.', 'high', 4),
  ('11111111-1111-1111-1111-111111111106', 'Low stock alerts', 'Products below threshold highlighted', '/inventory', 'Set low stock threshold. Item shows warning when below.', 'medium', 5),
  ('11111111-1111-1111-1111-111111111106', 'Category filtering', 'Filter by product category', '/inventory', 'Select category filter. Only matching items show.', 'medium', 6),
  ('11111111-1111-1111-1111-111111111106', 'Product search', 'Search products by name/SKU', '/inventory', 'Search by various terms. Correct results return.', 'high', 7),
  ('11111111-1111-1111-1111-111111111106', 'Stock transfer between locations', 'Transfer stock between stores', '/inventory/transfers', 'Create transfer. Dispatch. Receive. Stock moves.', 'high', 8),
  ('11111111-1111-1111-1111-111111111106', 'Stocktake functionality', 'Conduct stocktake and reconcile', '/stocktakes', 'Start stocktake. Count items. Submit discrepancies.', 'medium', 9),
  ('11111111-1111-1111-1111-111111111106', 'Product images', 'Upload and display product images', '/inventory/[id]', 'Upload image. Displays in list and detail.', 'low', 10),

-- Customer Management (Category 7)
  ('11111111-1111-1111-1111-111111111107', 'View customer list', 'Customer list loads correctly', '/customers', 'Open customers. List renders with data.', 'critical', 1),
  ('11111111-1111-1111-1111-111111111107', 'Create new customer', 'Add new customer profile', '/customers/new', 'Create customer with all details. Saves.', 'critical', 2),
  ('11111111-1111-1111-1111-111111111107', 'View customer profile', 'Customer detail page shows history', '/customers/[id]', 'View customer. See purchases, repairs, balance.', 'high', 3),
  ('11111111-1111-1111-1111-111111111107', 'Edit customer details', 'Update customer information', '/customers/[id]/edit', 'Edit customer. Save. Changes persist.', 'high', 4),
  ('11111111-1111-1111-1111-111111111107', 'Customer search', 'Search by name, email, phone', '/customers', 'Search various terms. Correct results.', 'high', 5),
  ('11111111-1111-1111-1111-111111111107', 'Customer transaction history', 'View all customer transactions', '/customers/[id]', 'All sales, repairs, invoices show in history.', 'medium', 6),
  ('11111111-1111-1111-1111-111111111107', 'Customer notes', 'Add notes to customer profile', '/customers/[id]', 'Add note. Note persists and shows.', 'low', 7),
  ('11111111-1111-1111-1111-111111111107', 'Duplicate customer detection', 'Warning for potential duplicates', '/customers/new', 'Create similar customer. Warning shows.', 'medium', 8),

-- Invoices & Quotes (Category 8)
  ('11111111-1111-1111-1111-111111111108', 'Create invoice', 'Generate new invoice', '/invoices/new', 'Create invoice with line items. Save.', 'critical', 1),
  ('11111111-1111-1111-1111-111111111108', 'Invoice PDF generation', 'PDF downloads correctly', '/invoices/[id]', 'Generate PDF. Opens/downloads correctly.', 'critical', 2),
  ('11111111-1111-1111-1111-111111111108', 'Email invoice', 'Send invoice via email', '/invoices/[id]', 'Email invoice. Customer receives.', 'high', 3),
  ('11111111-1111-1111-1111-111111111108', 'Mark invoice paid', 'Record payment on invoice', '/invoices/[id]', 'Mark paid. Status updates. Payment recorded.', 'high', 4),
  ('11111111-1111-1111-1111-111111111108', 'Create quote', 'Generate quote for customer', '/quotes/new', 'Create quote with items. Save.', 'high', 5),
  ('11111111-1111-1111-1111-111111111108', 'Convert quote to invoice', 'Transform quote to invoice', '/quotes/[id]', 'Convert quote. Invoice created with same items.', 'high', 6),
  ('11111111-1111-1111-1111-111111111108', 'Invoice list filtering', 'Filter by status, date, customer', '/invoices', 'Apply filters. Results match criteria.', 'medium', 7),

-- Financial Reports (Category 9)
  ('11111111-1111-1111-1111-111111111109', 'Financials dashboard loads', 'Financial overview displays', '/financials', 'Page loads. Charts and stats render.', 'critical', 1),
  ('11111111-1111-1111-1111-111111111109', 'Revenue by category', 'Revenue breakdown by type', '/financials', 'Category breakdown shows. Percentages correct.', 'high', 2),
  ('11111111-1111-1111-1111-111111111109', 'Date range filtering', 'Filter reports by date range', '/financials', 'Change dates. Data updates accordingly.', 'high', 3),
  ('11111111-1111-1111-1111-111111111109', 'EOD reconciliation', 'End of day cash-up process', '/eod', 'Complete EOD. Counts match or flag discrepancy.', 'critical', 4),
  ('11111111-1111-1111-1111-111111111109', 'Expense tracking', 'Record and view expenses', '/expenses', 'Add expense. Shows in list and reports.', 'high', 5),
  ('11111111-1111-1111-1111-111111111109', 'Export reports', 'Export financial data', '/financials', 'Export CSV/PDF. File contains correct data.', 'medium', 6),

-- Settings & Configuration (Category 10)
  ('11111111-1111-1111-1111-111111111110', 'Business settings save', 'Update business details', '/settings', 'Edit business name, address, etc. Save.', 'critical', 1),
  ('11111111-1111-1111-1111-111111111110', 'Team management', 'Add/remove team members', '/settings/team', 'Add user. Remove user. Permissions update.', 'critical', 2),
  ('11111111-1111-1111-1111-111111111110', 'Role permissions', 'Configure role permissions', '/settings/team/permissions', 'Edit role. Permissions affect access.', 'high', 3),
  ('11111111-1111-1111-1111-111111111110', 'Location management', 'Add/edit store locations', '/settings/locations', 'Add location. Edit details. Appears in system.', 'high', 4),
  ('11111111-1111-1111-1111-111111111110', 'Notification settings', 'Configure notification preferences', '/settings/notifications', 'Toggle notifications. Changes save.', 'medium', 5),
  ('11111111-1111-1111-1111-111111111110', 'Document numbering', 'Configure invoice/repair numbering', '/settings/numbering', 'Set prefix/format. New documents use it.', 'medium', 6),
  ('11111111-1111-1111-1111-111111111110', 'Email templates', 'Customize email templates', '/settings/email', 'Edit template. Send test. Content correct.', 'medium', 7),

-- Marketing & Campaigns (Category 11)
  ('11111111-1111-1111-1111-111111111111', 'Campaign creation', 'Create email campaign', '/marketing/campaigns/new', 'Create campaign. Select audience. Schedule.', 'high', 1),
  ('11111111-1111-1111-1111-111111111111', 'Bulk email sending', 'Send bulk emails', '/marketing/bulk-email', 'Compose email. Select recipients. Send.', 'high', 2),
  ('11111111-1111-1111-1111-111111111111', 'SMS campaigns', 'Send SMS campaigns', '/marketing/bulk-sms', 'Create SMS. Send to segment. Delivery confirms.', 'medium', 3),
  ('11111111-1111-1111-1111-111111111111', 'WhatsApp campaigns', 'WhatsApp message campaigns', '/marketing/whatsapp-campaigns', 'Send WhatsApp campaign. Messages deliver.', 'medium', 4),
  ('11111111-1111-1111-1111-111111111111', 'Customer segments', 'Create customer segments', '/marketing/segments', 'Create segment. Filters work. Correct customers.', 'medium', 5),
  ('11111111-1111-1111-1111-111111111111', 'Marketing analytics', 'View campaign performance', '/marketing/analytics', 'See open rates, clicks, conversions.', 'low', 6),

-- Data Migration (Category 12)
  ('11111111-1111-1111-1111-111111111112', 'File upload works', 'Upload Excel/CSV files', '/migration/new', 'Upload file. Processing begins.', 'critical', 1),
  ('11111111-1111-1111-1111-111111111112', 'Data preview shows', 'Preview uploaded data before import', '/migration/[id]/preview', 'See parsed data. Fields identified.', 'critical', 2),
  ('11111111-1111-1111-1111-111111111112', 'Field mapping works', 'Map columns to system fields', '/migration/[id]/mapping', 'Map all required fields. Save mapping.', 'high', 3),
  ('11111111-1111-1111-1111-111111111112', 'Duplicate detection', 'Identify potential duplicates', '/migration/[id]/duplicates', 'Duplicates flagged. Can resolve.', 'high', 4),
  ('11111111-1111-1111-1111-111111111112', 'Migration execution', 'Run data import', '/migration/[id]/execute', 'Execute import. Data imported correctly.', 'critical', 5),
  ('11111111-1111-1111-1111-111111111112', 'Migration results', 'View import results', '/migration/[id]/results', 'Success/error counts show. Can view details.', 'high', 6),

-- Appraisals & Passports (Category 13)
  ('11111111-1111-1111-1111-111111111113', 'Create appraisal', 'New jewelry appraisal', '/appraisals/new', 'Create appraisal with item details, value.', 'high', 1),
  ('11111111-1111-1111-1111-111111111113', 'Appraisal PDF', 'Generate appraisal certificate', '/appraisals/[id]', 'PDF generates with all details.', 'high', 2),
  ('11111111-1111-1111-1111-111111111113', 'Digital passport creation', 'Create jewelry passport', '/passports/new', 'Create passport with photos, specs.', 'high', 3),
  ('11111111-1111-1111-1111-111111111113', 'Passport QR code', 'QR code links to passport', '/passports/[id]', 'QR scans. Opens passport view.', 'medium', 4),
  ('11111111-1111-1111-1111-111111111113', 'Public verification', 'Public can verify passport', '/verify/[uid]', 'Public URL shows passport info.', 'high', 5),

-- Tasks & Workflow (Category 14)
  ('11111111-1111-1111-1111-111111111114', 'Create task', 'Add new task', '/tasks', 'Create task. Assign to user.', 'high', 1),
  ('11111111-1111-1111-1111-111111111114', 'Task list view', 'View all tasks', '/tasks', 'Tasks show by status. Can filter.', 'high', 2),
  ('11111111-1111-1111-1111-111111111114', 'Complete task', 'Mark task complete', '/tasks/[id]', 'Complete task. Status updates.', 'high', 3),
  ('11111111-1111-1111-1111-111111111114', 'Task due dates', 'Due date reminders work', '/tasks', 'Overdue tasks highlighted.', 'medium', 4),
  ('11111111-1111-1111-1111-111111111114', 'Task attachments', 'Add files to tasks', '/tasks/[id]', 'Upload attachment. Can view/download.', 'low', 5),

-- Integrations (Category 15)
  ('11111111-1111-1111-1111-111111111115', 'Stripe Connect setup', 'Connect Stripe account', '/settings/integrations', 'Complete Stripe onboarding. Payments work.', 'critical', 1),
  ('11111111-1111-1111-1111-111111111115', 'Xero integration', 'Connect Xero accounting', '/integrations/xero', 'Connect Xero. Invoices sync.', 'high', 2),
  ('11111111-1111-1111-1111-111111111115', 'Google Calendar sync', 'Connect Google Calendar', '/integrations/google-calendar', 'Connect calendar. Appointments sync.', 'medium', 3),
  ('11111111-1111-1111-1111-111111111115', 'WhatsApp integration', 'Connect WhatsApp Business', '/settings/integrations', 'Connect WhatsApp. Messages send.', 'high', 4),
  ('11111111-1111-1111-1111-111111111115', 'Shopify integration', 'Connect Shopify store', '/integrations/shopify', 'Connect Shopify. Products push.', 'medium', 5),

-- Customer-Facing Website (Category 16)
  ('11111111-1111-1111-1111-111111111116', 'Shop page loads', 'Customer shop page works', '/[subdomain]', 'Public shop loads. Products show.', 'critical', 1),
  ('11111111-1111-1111-1111-111111111116', 'Appointment booking', 'Book appointment online', '/[subdomain]/appointments', 'Select service, date, time. Submit booking.', 'high', 2),
  ('11111111-1111-1111-1111-111111111116', 'Enquiry form', 'Submit enquiry via website', '/[subdomain]/enquiry', 'Fill form. Submit. Appears in dashboard.', 'high', 3),
  ('11111111-1111-1111-1111-111111111116', 'Repair tracking', 'Customer tracks repair status', '/[subdomain]/track', 'Enter reference. See current status.', 'high', 4),
  ('11111111-1111-1111-1111-111111111116', 'Catalogue browsing', 'Browse product catalogue', '/[subdomain]/catalogue', 'Products display. Can view details.', 'medium', 5),

-- Mobile & Responsiveness (Category 17)
  ('11111111-1111-1111-1111-111111111117', 'Dashboard mobile layout', 'Dashboard works on mobile', '/dashboard', 'On mobile: layout adapts, no horizontal scroll.', 'high', 1),
  ('11111111-1111-1111-1111-111111111117', 'POS mobile usability', 'POS works on tablet', '/pos', 'POS usable on iPad. Buttons accessible.', 'high', 2),
  ('11111111-1111-1111-1111-111111111117', 'Forms work on mobile', 'Forms submit on mobile', 'Various', 'Complete forms on mobile. All fields accessible.', 'high', 3),
  ('11111111-1111-1111-1111-111111111117', 'Tables scroll on mobile', 'Data tables scrollable', 'Various', 'Tables horizontally scroll. Data visible.', 'medium', 4),
  ('11111111-1111-1111-1111-111111111117', 'Touch targets sized', 'Buttons large enough for touch', 'Various', 'All interactive elements easily tappable.', 'medium', 5),

-- Security & Permissions (Category 18)
  ('11111111-1111-1111-1111-111111111118', 'Role-based access works', 'Permissions restrict access', '/dashboard', 'Staff role cannot access admin settings.', 'critical', 1),
  ('11111111-1111-1111-1111-111111111118', 'Data isolation between tenants', 'Tenants cannot see each other', '/dashboard', 'Tenant A cannot access Tenant B data.', 'critical', 2),
  ('11111111-1111-1111-1111-111111111118', 'Session timeout', 'Inactive sessions expire', '/dashboard', 'After timeout period, requires re-login.', 'high', 3),
  ('11111111-1111-1111-1111-111111111118', 'Audit log captures actions', 'Important actions logged', '/admin/audit', 'Key actions appear in audit log.', 'medium', 4),
  ('11111111-1111-1111-1111-111111111118', 'Secure password requirements', 'Weak passwords rejected', '/signup', 'Short/simple passwords not accepted.', 'high', 5),

-- Performance & Reliability (Category 19)
  ('11111111-1111-1111-1111-111111111119', 'Page load times acceptable', 'Pages load under 3 seconds', 'Various', 'Key pages load quickly. No long spinners.', 'high', 1),
  ('11111111-1111-1111-1111-111111111119', 'Error states handled', 'Errors show friendly messages', 'Various', 'API errors show user-friendly message.', 'high', 2),
  ('11111111-1111-1111-1111-111111111119', 'Empty states shown', 'Empty lists have helpful text', 'Various', 'No data shows helpful empty state, not broken.', 'medium', 3),
  ('11111111-1111-1111-1111-111111111119', 'Loading states present', 'Loading indicators during fetches', 'Various', 'Data loading shows spinner/skeleton.', 'medium', 4),
  ('11111111-1111-1111-1111-111111111119', 'Form validation works', 'Invalid input shows errors', 'Various', 'Required fields, email format validated.', 'high', 5),

-- Billing & Subscriptions (Category 20)
  ('11111111-1111-1111-1111-111111111120', 'View current plan', 'Billing page shows plan details', '/billing', 'Current plan, usage, renewal date shows.', 'critical', 1),
  ('11111111-1111-1111-1111-111111111120', 'Upgrade plan', 'Can upgrade subscription', '/billing', 'Upgrade flow works. Plan changes.', 'critical', 2),
  ('11111111-1111-1111-1111-111111111120', 'Payment method update', 'Update credit card', '/billing', 'Add new card. Update default payment.', 'high', 3),
  ('11111111-1111-1111-1111-111111111120', 'Invoice history', 'View past invoices', '/billing', 'Past invoices list. Can download.', 'medium', 4),
  ('11111111-1111-1111-1111-111111111120', 'Trial expiration handling', 'Trial end prompts upgrade', '/dashboard', 'Trial expires. Prompted to subscribe.', 'critical', 5),
  ('11111111-1111-1111-1111-111111111120', 'Subscription cancellation', 'Can cancel subscription', '/billing', 'Cancel flow works. Access during period.', 'high', 6);

-- Create initial test results (all pending) for each checklist item
INSERT INTO qa_test_results (checklist_item_id, status, notes)
SELECT id, 'pending', NULL FROM qa_checklist_items;
