# Browser Concurrency Test Guide

This guide walks through manual browser testing to verify concurrency protections work through the real UI.

## Prerequisites

- Two browser windows (e.g., Chrome + Firefox, or two Chrome profiles)
- Both logged in as the same user (or different users in same tenant)
- Demo data with: at least one unpaid invoice, one active voucher, one customer with store credit, one item with qty=1, one active layby, one pending transfer

## Test A: Concurrent Invoice Payment

**Setup:** Find an unpaid invoice with total = $100

1. Open `/invoices/[id]` in both browsers
2. In both: Click "Record Payment", enter $50, select cash
3. Click "Submit" in both browsers as simultaneously as possible

**Expected Result:**
- Both payments should be recorded
- Invoice `amount_paid` should equal $100 (sum of both)
- Invoice status should be "paid"
- Payment history should show 2 payments

**If broken:** One payment lost, or amount_paid is $50 not $100

---

## Test B: Concurrent Voucher Redemption

**Setup:** Create a voucher with $100 balance

1. Open `/pos` in both browsers
2. Add any item to cart in both
3. In both: Apply the same voucher code
4. Complete sale in both browsers as simultaneously as possible

**Expected Result:**
- First sale succeeds with voucher applied
- Second sale either fails or shows voucher already redeemed
- Voucher balance is $0 after (not negative, not double-deducted)

**If broken:** Both sales succeed with voucher, or voucher balance goes negative

---

## Test C: Concurrent Store Credit Usage

**Setup:** Customer with $200 store credit

1. Open `/pos` in both browsers
2. Add $150 item to cart in both
3. In both: Select the customer, apply $150 store credit
4. Complete sale in both browsers as simultaneously as possible

**Expected Result:**
- One sale succeeds with $150 store credit
- Other sale fails with "Insufficient store credit"
- Customer store_credit is now $50 (not -$100)

**If broken:** Both sales complete with credit, or balance goes negative

---

## Test D: Last Stock Unit Sale

**Setup:** Inventory item with quantity = 1

1. Open `/pos` in both browsers
2. Add the qty=1 item to cart in both
3. Complete sale in both browsers as simultaneously as possible

**Expected Result:**
- One sale completes successfully
- Other sale fails with "Insufficient stock" or "Just sold out"
- Inventory quantity is 0 (not -1)

**If broken:** Both sales complete, or quantity goes negative

---

## Test E: Concurrent Layby Completion

**Setup:** Layby that is $1 away from completion

1. Open `/laybys/[id]` in both browsers
2. In both: Click "Record Payment", enter final $1
3. Submit in both browsers as simultaneously as possible

**Expected Result:**
- Layby completes only once
- Stock deducted only once
- No duplicate completion error for user
- Status is "completed"

**If broken:** Double stock deduction, or both show completion success

---

## Test F: Concurrent Transfer Dispatch/Receive

**Setup:** Create a pending transfer

### Test F1: Double Dispatch
1. Open `/inventory/transfers/[id]` in both browsers
2. Click "Dispatch" in both simultaneously

**Expected Result:**
- Transfer status is "in_transit"
- One session gets success, other gets "already dispatched" or similar
- Stock deducted once from source

### Test F2: Double Receive (after dispatching once)
1. Open the same transfer in both browsers
2. Click "Receive" in both simultaneously

**Expected Result:**
- Transfer status is "completed"
- Stock added once to destination
- No double receive

---

## Verification Checklist

After each test, verify in the database or admin UI:

- [ ] No negative quantities in inventory
- [ ] No negative balances (store credit, voucher)
- [ ] No duplicate payments
- [ ] Correct final totals
- [ ] Audit trail shows correct operations

## Health Check

Visit `/api/health/concurrency` to verify:

```json
{
  "idempotency": { "healthy": true, "backend": "supabase" },
  "db_constraints": { ... all true ... },
  "protections": { ... }
}
```

If `idempotency.healthy` is false, check Supabase connection.
