import { createAdminClient } from '@/lib/supabase/admin';
import type { CustomerSegment, CustomerForMarketing } from './types';
import logger from "@/lib/logger";

/**
 * Get customers matching a segment's rules
 */
export async function getCustomersInSegment(
  tenantId: string,
  segment: CustomerSegment
): Promise<CustomerForMarketing[]> {
  const admin = createAdminClient();
  const rules = segment.rules;

  // Build base query with customer spending aggregates
  let query = admin
    .from('customers')
    .select(`
      id,
      full_name,
      email,
      phone,
      tags,
      created_at
    `)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .not('email', 'is', null);

  // Apply system segment rules
  switch (rules.type) {
    case 'new':
      // Customers created in last X days
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - (rules.days || 30));
      query = query.gte('created_at', daysAgo.toISOString());
      break;

    case 'repair':
      // Customers with repairs - need subquery
      const { data: repairCustomerIds } = await admin
        .from('repairs')
        .select('customer_id')
        .eq('tenant_id', tenantId)
        .not('customer_id', 'is', null);
      
      const uniqueRepairCustomers = [...new Set(repairCustomerIds?.map(r => r.customer_id) || [])];
      if (uniqueRepairCustomers.length > 0) {
        query = query.in('id', uniqueRepairCustomers);
      } else {
        return []; // No repair customers
      }
      break;

    // For VIP, lapsed, and high_value, we need to fetch all customers and calculate
    case 'vip':
    case 'lapsed':
    case 'high_value':
    case 'custom':
      // Will be processed after fetching
      break;
  }

  const { data: customers, error } = await query.order('created_at', { ascending: false });

  if (error || !customers) {
    logger.error('Error fetching customers for segment:', error);
    return [];
  }

  // If we need spending data, fetch it
  if (rules.type === 'vip' || rules.type === 'lapsed' || rules.type === 'high_value' || rules.type === 'custom') {
    const customerIds = customers.map(c => c.id);
    
    // Get sales data for spending calculation
    const { data: salesData } = await admin
      .from('sales')
      .select('customer_id, total, created_at')
      .eq('tenant_id', tenantId)
      .in('customer_id', customerIds);

    // Aggregate per customer
    const customerStats = new Map<string, { totalSpend: number; purchaseCount: number; lastPurchase: string | null }>();
    
    for (const sale of salesData || []) {
      const customerId = sale.customer_id;
      if (!customerId) continue;
      
      const existing = customerStats.get(customerId) || { totalSpend: 0, purchaseCount: 0, lastPurchase: null };
      existing.totalSpend += sale.total || 0;
      existing.purchaseCount++;
      if (!existing.lastPurchase || sale.created_at > existing.lastPurchase) {
        existing.lastPurchase = sale.created_at;
      }
      customerStats.set(customerId, existing);
    }

    // Enrich customers with spending data
    const enrichedCustomers: CustomerForMarketing[] = customers.map(c => ({
      ...c,
      total_spend: customerStats.get(c.id)?.totalSpend || 0,
      purchase_count: customerStats.get(c.id)?.purchaseCount || 0,
      last_purchase_at: customerStats.get(c.id)?.lastPurchase || null,
    }));

    // Apply filters based on segment type
    let filteredCustomers = enrichedCustomers;

    switch (rules.type) {
      case 'vip':
        // Top X percentile by spend
        const percentile = rules.percentile || 10;
        const sorted = [...enrichedCustomers].sort((a, b) => (b.total_spend || 0) - (a.total_spend || 0));
        const cutoff = Math.ceil(sorted.length * (percentile / 100));
        filteredCustomers = sorted.slice(0, cutoff);
        break;

      case 'lapsed':
        // No purchase in X months
        const monthsAgo = new Date();
        monthsAgo.setMonth(monthsAgo.getMonth() - (rules.months || 6));
        filteredCustomers = enrichedCustomers.filter(c => {
          if (!c.last_purchase_at) return true; // Never purchased
          return new Date(c.last_purchase_at) < monthsAgo;
        });
        break;

      case 'high_value':
        // Single purchase over X amount - need to check individual sales
        const minAmount = rules.amount || 1000;
        const { data: highValueCustomerIds } = await admin
          .from('sales')
          .select('customer_id')
          .eq('tenant_id', tenantId)
          .gte('total', minAmount);
        
        const highValueIds = new Set(highValueCustomerIds?.map(s => s.customer_id) || []);
        filteredCustomers = enrichedCustomers.filter(c => highValueIds.has(c.id));
        break;

      case 'custom':
        // Apply custom conditions
        if (rules.conditions) {
          for (const condition of rules.conditions) {
            filteredCustomers = applyCondition(filteredCustomers, condition);
          }
        }
        break;
    }

    return filteredCustomers;
  }

  return customers as CustomerForMarketing[];
}

/**
 * Apply a single condition filter to customers
 */
function applyCondition(
  customers: CustomerForMarketing[],
  condition: { field: string; operator: string; value: string | number | string[] }
): CustomerForMarketing[] {
  return customers.filter(customer => {
    let fieldValue: unknown;
    
    switch (condition.field) {
      case 'total_spend':
        fieldValue = customer.total_spend || 0;
        break;
      case 'purchase_count':
        fieldValue = customer.purchase_count || 0;
        break;
      case 'last_purchase':
        fieldValue = customer.last_purchase_at ? new Date(customer.last_purchase_at).getTime() : 0;
        break;
      case 'tags':
        fieldValue = customer.tags || [];
        break;
      default:
        return true;
    }

    switch (condition.operator) {
      case 'gt':
        return (fieldValue as number) > (condition.value as number);
      case 'lt':
        return (fieldValue as number) < (condition.value as number);
      case 'gte':
        return (fieldValue as number) >= (condition.value as number);
      case 'lte':
        return (fieldValue as number) <= (condition.value as number);
      case 'eq':
        return fieldValue === condition.value;
      case 'contains':
        if (Array.isArray(fieldValue)) {
          return fieldValue.some(v => 
            Array.isArray(condition.value) 
              ? condition.value.includes(v) 
              : v === condition.value
          );
        }
        return false;
      case 'not_contains':
        if (Array.isArray(fieldValue)) {
          return !fieldValue.some(v => 
            Array.isArray(condition.value) 
              ? condition.value.includes(v) 
              : v === condition.value
          );
        }
        return true;
      default:
        return true;
    }
  });
}

/**
 * Update customer count for a segment
 */
export async function updateSegmentCount(tenantId: string, segmentId: string): Promise<number> {
  const admin = createAdminClient();

  const { data: segment } = await admin
    .from('customer_segments')
    .select('*')
    .eq('id', segmentId)
    .eq('tenant_id', tenantId)
    .single();

  if (!segment) return 0;

  const customers = await getCustomersInSegment(tenantId, segment as CustomerSegment);
  const count = customers.length;

  await admin
    .from('customer_segments')
    .update({ customer_count: count, updated_at: new Date().toISOString() })
    .eq('id', segmentId);

  return count;
}

/**
 * Get all customers for a recipient filter
 */
export async function getRecipientsForFilter(
  tenantId: string,
  recipientType: 'all' | 'segment' | 'tags' | 'manual',
  filter: { segment_id?: string; tags?: string[]; customer_ids?: string[] }
): Promise<CustomerForMarketing[]> {
  const admin = createAdminClient();

  switch (recipientType) {
    case 'all':
      const { data: allCustomers } = await admin
        .from('customers')
        .select('id, full_name, email, phone, tags, created_at')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .not('email', 'is', null);
      return (allCustomers || []) as CustomerForMarketing[];

    case 'segment':
      if (!filter.segment_id) return [];
      const { data: segment } = await admin
        .from('customer_segments')
        .select('*')
        .eq('id', filter.segment_id)
        .eq('tenant_id', tenantId)
        .single();
      if (!segment) return [];
      return getCustomersInSegment(tenantId, segment as CustomerSegment);

    case 'tags':
      if (!filter.tags || filter.tags.length === 0) return [];
      const { data: taggedCustomers } = await admin
        .from('customers')
        .select('id, full_name, email, phone, tags, created_at')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .not('email', 'is', null)
        .overlaps('tags', filter.tags);
      return (taggedCustomers || []) as CustomerForMarketing[];

    case 'manual':
      if (!filter.customer_ids || filter.customer_ids.length === 0) return [];
      const { data: manualCustomers } = await admin
        .from('customers')
        .select('id, full_name, email, phone, tags, created_at')
        .eq('tenant_id', tenantId)
        .in('id', filter.customer_ids)
        .not('email', 'is', null);
      return (manualCustomers || []) as CustomerForMarketing[];

    default:
      return [];
  }
}
