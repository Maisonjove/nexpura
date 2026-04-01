// Comprehensive API and Data Integrity Test for Nexpura
// Tests database operations, data integrity, and API endpoints

const SUPABASE_URL = 'https://vkpjocnrefjfpuovzinn.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrcGpvY25yZWZqZnB1b3Z6aW5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIyMTIwNywiZXhwIjoyMDg4Nzk3MjA3fQ.5M-a0_dB0xxx8dHO_X-l8ePcKhyIZ-T38IC85BTcFEo';
const TENANT = '0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a';

const results = {
  categories: {},
  bugs: { critical: [], high: [], medium: [], low: [] }
};

function log(msg) {
  console.log(`[${new Date().toISOString().substring(11, 19)}] ${msg}`);
}

async function apiCall(endpoint, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, opts);
  const data = await response.json();
  return { status: response.status, data };
}

async function testCategory(name, tests) {
  log(`=== ${name} ===`);
  results.categories[name] = { tests: [], passed: 0, failed: 0 };
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result.pass) {
        results.categories[name].passed++;
        results.categories[name].tests.push({ name: test.name, pass: true });
        log(`✅ ${test.name}`);
      } else {
        results.categories[name].failed++;
        results.categories[name].tests.push({ name: test.name, pass: false, error: result.error });
        log(`❌ ${test.name}: ${result.error}`);
        if (result.severity) {
          results.bugs[result.severity].push({ category: name, test: test.name, error: result.error });
        }
      }
    } catch (e) {
      results.categories[name].failed++;
      results.categories[name].tests.push({ name: test.name, pass: false, error: e.message });
      log(`❌ ${test.name}: ${e.message}`);
    }
  }
}

async function main() {
  // E. CUSTOMERS / CRM
  await testCategory('E. CUSTOMERS', [
    {
      name: 'List customers',
      fn: async () => {
        const { status, data } = await apiCall(`customers?tenant_id=eq.${TENANT}&limit=10`);
        if (status !== 200) return { pass: false, error: `Status ${status}`, severity: 'high' };
        if (!Array.isArray(data)) return { pass: false, error: 'Not array', severity: 'high' };
        return { pass: data.length > 0 };
      }
    },
    {
      name: 'Customer has required fields',
      fn: async () => {
        const { data } = await apiCall(`customers?tenant_id=eq.${TENANT}&limit=1`);
        const c = data[0];
        if (!c) return { pass: false, error: 'No customers' };
        const required = ['id', 'full_name', 'tenant_id'];
        const missing = required.filter(f => !c.hasOwnProperty(f));
        return missing.length === 0 ? { pass: true } : { pass: false, error: `Missing: ${missing.join(', ')}` };
      }
    },
    {
      name: 'Create customer works',
      fn: async () => {
        const testCustomer = {
          tenant_id: TENANT,
          full_name: 'QA Test Customer ' + Date.now(),
          email: `qatest${Date.now()}@test.com`
        };
        const { status, data } = await apiCall('customers', 'POST', testCustomer);
        if (status !== 201 && status !== 200) return { pass: false, error: `Create failed: ${status}`, severity: 'critical' };
        // Cleanup
        if (data[0]?.id) await apiCall(`customers?id=eq.${data[0].id}`, 'DELETE');
        return { pass: true };
      }
    }
  ]);

  // F. INVENTORY
  await testCategory('F. INVENTORY', [
    {
      name: 'List inventory',
      fn: async () => {
        const { status, data } = await apiCall(`inventory?tenant_id=eq.${TENANT}&limit=10`);
        if (status !== 200) return { pass: false, error: `Status ${status}`, severity: 'high' };
        return { pass: data.length > 0 };
      }
    },
    {
      name: 'Inventory has jewellery fields',
      fn: async () => {
        const { data } = await apiCall(`inventory?tenant_id=eq.${TENANT}&limit=1`);
        const i = data[0];
        const fields = ['metal_type', 'stone_type', 'ring_size', 'retail_price', 'quantity'];
        const hasFields = fields.some(f => i?.hasOwnProperty(f));
        return { pass: hasFields };
      }
    },
    {
      name: 'Low stock items queryable',
      fn: async () => {
        const { status } = await apiCall(`inventory?tenant_id=eq.${TENANT}&quantity=lt.3&limit=5`);
        return { pass: status === 200 };
      }
    }
  ]);

  // I. REPAIRS
  await testCategory('I. REPAIRS', [
    {
      name: 'List repairs',
      fn: async () => {
        const { status, data } = await apiCall(`repairs?tenant_id=eq.${TENANT}&limit=10`);
        return { pass: status === 200 && data.length > 0 };
      }
    },
    {
      name: 'Repair stages exist',
      fn: async () => {
        const { data } = await apiCall(`repairs?tenant_id=eq.${TENANT}&select=stage`);
        const stages = [...new Set(data.map(r => r.stage))];
        const expectedStages = ['intake', 'in_progress', 'ready', 'collected'];
        const hasStages = expectedStages.some(s => stages.includes(s));
        return { pass: hasStages, error: hasStages ? null : `Only found: ${stages.join(', ')}` };
      }
    },
    {
      name: 'Repair linked to customer',
      fn: async () => {
        const { data } = await apiCall(`repairs?tenant_id=eq.${TENANT}&customer_id=not.is.null&limit=1`);
        return { pass: data.length > 0 };
      }
    }
  ]);

  // J. BESPOKE
  await testCategory('J. BESPOKE', [
    {
      name: 'List bespoke jobs',
      fn: async () => {
        const { status, data } = await apiCall(`bespoke_jobs?tenant_id=eq.${TENANT}&limit=10`);
        return { pass: status === 200 && data.length > 0 };
      }
    },
    {
      name: 'Bespoke has specs fields',
      fn: async () => {
        const { data } = await apiCall(`bespoke_jobs?tenant_id=eq.${TENANT}&limit=1`);
        const b = data[0];
        return { pass: b && (b.jewellery_type || b.metal_type || b.stone_type) };
      }
    }
  ]);

  // M. INVOICES / QUOTES / PAYMENTS
  await testCategory('M. INVOICES', [
    {
      name: 'List invoices',
      fn: async () => {
        const { status, data } = await apiCall(`invoices?tenant_id=eq.${TENANT}&limit=10`);
        return { pass: status === 200 && data.length > 0 };
      }
    },
    {
      name: 'Invoice has totals',
      fn: async () => {
        const { data } = await apiCall(`invoices?tenant_id=eq.${TENANT}&limit=1`);
        const inv = data[0];
        return { pass: inv && typeof inv.total === 'number' };
      }
    },
    {
      name: 'Payments linked to invoices',
      fn: async () => {
        const { status, data } = await apiCall(`payments?tenant_id=eq.${TENANT}&limit=5`);
        return { pass: status === 200 && data.some(p => p.invoice_id) };
      }
    }
  ]);

  // C. SALES / POS
  await testCategory('C. SALES', [
    {
      name: 'List sales',
      fn: async () => {
        const { status, data } = await apiCall(`sales?tenant_id=eq.${TENANT}&limit=10`);
        return { pass: status === 200 && data.length > 0 };
      }
    },
    {
      name: 'Sale items exist',
      fn: async () => {
        const { data: sales } = await apiCall(`sales?tenant_id=eq.${TENANT}&limit=1`);
        if (!sales[0]) return { pass: false, error: 'No sales' };
        const { data: items } = await apiCall(`sale_items?sale_id=eq.${sales[0].id}`);
        return { pass: items.length > 0 };
      }
    },
    {
      name: 'Payment methods vary',
      fn: async () => {
        const { data } = await apiCall(`sales?tenant_id=eq.${TENANT}&select=payment_method`);
        const methods = [...new Set(data.map(s => s.payment_method).filter(Boolean))];
        return { pass: methods.length > 1, error: `Methods: ${methods.join(', ')}` };
      }
    }
  ]);

  // D. LAYBY
  await testCategory('D. LAYBY', [
    {
      name: 'Layby sales exist',
      fn: async () => {
        const { status, data } = await apiCall(`sales?tenant_id=eq.${TENANT}&status=eq.layby`);
        return { pass: status === 200, error: data.length === 0 ? 'No laybys (acceptable)' : null };
      }
    },
    {
      name: 'Layby payments table accessible',
      fn: async () => {
        const { status } = await apiCall(`layby_payments?tenant_id=eq.${TENANT}&limit=1`);
        return { pass: status === 200 };
      }
    }
  ]);

  // N. REFUNDS / STORE CREDIT / VOUCHERS
  await testCategory('N. REFUNDS/VOUCHERS', [
    {
      name: 'Refunds table accessible',
      fn: async () => {
        const { status } = await apiCall(`refunds?tenant_id=eq.${TENANT}&limit=1`);
        return { pass: status === 200 };
      }
    },
    {
      name: 'Gift vouchers exist',
      fn: async () => {
        const { data } = await apiCall(`gift_vouchers?tenant_id=eq.${TENANT}`);
        return { pass: data.length > 0 };
      }
    },
    {
      name: 'Store credit history accessible',
      fn: async () => {
        const { status } = await apiCall(`customer_store_credit_history?tenant_id=eq.${TENANT}&limit=1`);
        return { pass: status === 200 };
      }
    }
  ]);

  // O. APPRAISALS / PASSPORTS
  await testCategory('O. APPRAISALS', [
    {
      name: 'List appraisals',
      fn: async () => {
        const { status, data } = await apiCall(`appraisals?tenant_id=eq.${TENANT}`);
        return { pass: status === 200 && data.length > 0 };
      }
    },
    {
      name: 'Appraisal has values',
      fn: async () => {
        const { data } = await apiCall(`appraisals?tenant_id=eq.${TENANT}&limit=1`);
        return { pass: data[0]?.appraised_value !== null };
      }
    },
    {
      name: 'Passports table accessible',
      fn: async () => {
        const { status } = await apiCall(`passports?tenant_id=eq.${TENANT}`);
        return { pass: status === 200 };
      }
    }
  ]);

  // G. STOCKTAKE
  await testCategory('G. STOCKTAKE', [
    {
      name: 'Stocktakes table accessible',
      fn: async () => {
        const { status } = await apiCall(`stocktakes?tenant_id=eq.${TENANT}`);
        return { pass: status === 200 };
      }
    },
    {
      name: 'Stocktake items accessible',
      fn: async () => {
        const { status } = await apiCall(`stocktake_items?tenant_id=eq.${TENANT}&limit=1`);
        return { pass: status === 200 };
      }
    }
  ]);

  // H. STOCK TRANSFERS
  await testCategory('H. STOCK TRANSFERS', [
    {
      name: 'Stock transfers accessible',
      fn: async () => {
        const { status } = await apiCall(`stock_transfers?tenant_id=eq.${TENANT}`);
        return { pass: status === 200 };
      }
    },
    {
      name: 'Transfer items accessible',
      fn: async () => {
        const { status } = await apiCall(`stock_transfer_items?limit=1`);
        return { pass: status === 200 };
      }
    },
    {
      name: 'Locations exist',
      fn: async () => {
        const { data } = await apiCall(`locations?tenant_id=eq.${TENANT}`);
        return { pass: data.length > 0 };
      }
    }
  ]);

  // L. WORKSHOP / TASKS
  await testCategory('L. TASKS', [
    {
      name: 'List tasks',
      fn: async () => {
        const { status, data } = await apiCall(`tasks?tenant_id=eq.${TENANT}`);
        return { pass: status === 200 && data.length > 0 };
      }
    },
    {
      name: 'Tasks have statuses',
      fn: async () => {
        const { data } = await apiCall(`tasks?tenant_id=eq.${TENANT}&select=status`);
        const statuses = [...new Set(data.map(t => t.status))];
        return { pass: statuses.length > 0 };
      }
    }
  ]);

  // P. BILLING / PLANS
  await testCategory('P. BILLING', [
    {
      name: 'Subscription exists',
      fn: async () => {
        const { data } = await apiCall(`subscriptions?tenant_id=eq.${TENANT}`);
        return { pass: data.length > 0 && data[0].status === 'active' };
      }
    },
    {
      name: 'Tenant has plan',
      fn: async () => {
        const { data } = await apiCall(`tenants?id=eq.${TENANT}`);
        return { pass: data[0]?.plan !== null };
      }
    }
  ]);

  // Q. WEBSITE BUILDER
  await testCategory('Q. WEBSITE', [
    {
      name: 'Website config exists',
      fn: async () => {
        const { data } = await apiCall(`website_config?tenant_id=eq.${TENANT}`);
        return { pass: data.length > 0 };
      }
    },
    {
      name: 'Website has subdomain',
      fn: async () => {
        const { data } = await apiCall(`website_config?tenant_id=eq.${TENANT}`);
        return { pass: !!data[0]?.subdomain };
      }
    }
  ]);

  // R. DATA MIGRATION
  await testCategory('R. MIGRATION', [
    {
      name: 'Migration sessions accessible',
      fn: async () => {
        const { status } = await apiCall(`migration_sessions?tenant_id=eq.${TENANT}`);
        return { pass: status === 200 };
      }
    },
    {
      name: 'Migration files accessible',
      fn: async () => {
        const { status } = await apiCall(`migration_files?tenant_id=eq.${TENANT}`);
        return { pass: status === 200 };
      }
    }
  ]);

  // T. SETTINGS
  await testCategory('T. SETTINGS', [
    {
      name: 'Tenant settings exist',
      fn: async () => {
        const { data } = await apiCall(`tenants?id=eq.${TENANT}`);
        const t = data[0];
        return { pass: t && t.currency && t.timezone };
      }
    },
    {
      name: 'Team members exist',
      fn: async () => {
        const { data } = await apiCall(`team_members?tenant_id=eq.${TENANT}`);
        return { pass: data.length > 0 };
      }
    },
    {
      name: 'Numbering sequences set',
      fn: async () => {
        const { data } = await apiCall(`tenants?id=eq.${TENANT}`);
        const t = data[0];
        return { pass: t && t.invoice_sequence >= 1 && t.repair_sequence >= 1 };
      }
    }
  ]);

  // U. REPORTS / EOD
  await testCategory('U. REPORTS', [
    {
      name: 'EOD table accessible',
      fn: async () => {
        const { status } = await apiCall(`eod_reconciliations?tenant_id=eq.${TENANT}`);
        return { pass: status === 200 };
      }
    },
    {
      name: 'Audit logs accessible',
      fn: async () => {
        const { status } = await apiCall(`audit_logs?tenant_id=eq.${TENANT}&limit=1`);
        return { pass: status === 200 };
      }
    }
  ]);

  // DATA INTEGRITY CHECKS
  await testCategory('DATA INTEGRITY', [
    {
      name: 'No orphan sale items',
      fn: async () => {
        const { data: items } = await apiCall(`sale_items?tenant_id=eq.${TENANT}&limit=100`);
        const { data: sales } = await apiCall(`sales?tenant_id=eq.${TENANT}&select=id`);
        const saleIds = new Set(sales.map(s => s.id));
        const orphans = items.filter(i => !saleIds.has(i.sale_id));
        return orphans.length === 0 ? { pass: true } : { pass: false, error: `${orphans.length} orphan items`, severity: 'medium' };
      }
    },
    {
      name: 'No orphan invoice line items',
      fn: async () => {
        const { data: items } = await apiCall(`invoice_line_items?tenant_id=eq.${TENANT}&limit=100`);
        const { data: invoices } = await apiCall(`invoices?tenant_id=eq.${TENANT}&select=id`);
        const invoiceIds = new Set(invoices.map(i => i.id));
        const orphans = items.filter(i => !invoiceIds.has(i.invoice_id));
        return orphans.length === 0 ? { pass: true } : { pass: false, error: `${orphans.length} orphan items`, severity: 'medium' };
      }
    },
    {
      name: 'Repairs have valid stages',
      fn: async () => {
        const validStages = ['intake', 'assessed', 'quoted', 'approved', 'in_progress', 'ready', 'collected', 'cancelled'];
        const { data } = await apiCall(`repairs?tenant_id=eq.${TENANT}&select=stage`);
        const invalid = data.filter(r => !validStages.includes(r.stage));
        return invalid.length === 0 ? { pass: true } : { pass: false, error: `${invalid.length} invalid stages`, severity: 'medium' };
      }
    },
    {
      name: 'Invoice totals match line items',
      fn: async () => {
        const { data: invoices } = await apiCall(`invoices?tenant_id=eq.${TENANT}&limit=10`);
        let mismatches = 0;
        for (const inv of invoices) {
          const { data: items } = await apiCall(`invoice_line_items?invoice_id=eq.${inv.id}`);
          const lineTotal = items.reduce((sum, i) => sum + Number(i.total || 0), 0);
          // Allow small rounding differences
          if (Math.abs(lineTotal - Number(inv.subtotal || 0)) > 0.01 && items.length > 0) {
            mismatches++;
          }
        }
        return mismatches === 0 ? { pass: true } : { pass: false, error: `${mismatches} invoices with mismatched totals`, severity: 'medium' };
      }
    }
  ]);

  // OUTPUT RESULTS
  console.log('\n\n========================================');
  console.log('API & DATA INTEGRITY TEST RESULTS');
  console.log('========================================\n');

  console.log('## PASS/FAIL BY CATEGORY');
  let totalPassed = 0, totalFailed = 0;
  for (const [cat, data] of Object.entries(results.categories)) {
    const status = data.failed === 0 ? 'PASS' : (data.passed > 0 ? 'PARTIAL' : 'FAIL');
    console.log(`${cat}: ${status} (${data.passed}/${data.passed + data.failed})`);
    totalPassed += data.passed;
    totalFailed += data.failed;
  }

  console.log(`\nTOTAL: ${totalPassed}/${totalPassed + totalFailed} tests passed`);

  console.log('\n## BUGS FOUND');
  for (const [severity, bugs] of Object.entries(results.bugs)) {
    if (bugs.length > 0) {
      console.log(`\n### ${severity.toUpperCase()}`);
      bugs.forEach(b => console.log(`- [${b.category}] ${b.test}: ${b.error}`));
    }
  }

  console.log('\n## FAILED TESTS');
  for (const [cat, data] of Object.entries(results.categories)) {
    for (const test of data.tests) {
      if (!test.pass) {
        console.log(`- [${cat}] ${test.name}: ${test.error || 'Failed'}`);
      }
    }
  }
}

main().catch(console.error);
