-- Order messages: customer ↔ jeweller thread attached to a repair or bespoke job.
--
-- The customer-facing side posts via the public /track/[trackingId] page (no
-- auth) — the tracking_id format validation + lookup through server actions
-- enforces that a customer can only post on the job whose tracking_id they
-- possess. RLS on the table itself is written for authenticated staff only;
-- the public insert path goes through a server action using the admin
-- service role after it's validated the tracking_id.
--
-- Jeweller-side reads/writes are gated by tenant_id via the standard pattern.

CREATE TABLE IF NOT EXISTS order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_type TEXT NOT NULL CHECK (order_type IN ('repair', 'bespoke')),
  order_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'staff')),
  -- For staff messages, the authenticated user who wrote the reply. NULL for
  -- customer messages (we never have a user id for them).
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Human-readable display name cached at send time (e.g. "Joe the Jeweller")
  -- so the customer's view doesn't need a staff-lookup join.
  sender_display_name TEXT,
  body TEXT NOT NULL CHECK (length(body) > 0 AND length(body) <= 4000),
  message_type TEXT NOT NULL DEFAULT 'general'
    CHECK (message_type IN ('general', 'amendment_request', 'reply')),
  -- When a staff member has marked this message read. NULL = unread.
  -- Only meaningful for customer-originated messages.
  read_by_staff_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup by order (thread view)
CREATE INDEX IF NOT EXISTS idx_order_messages_order
  ON order_messages(order_type, order_id, created_at DESC);

-- Fast lookup of unread customer messages per tenant (notification badges)
CREATE INDEX IF NOT EXISTS idx_order_messages_unread_customer
  ON order_messages(tenant_id)
  WHERE read_by_staff_at IS NULL AND sender_type = 'customer';

ALTER TABLE order_messages ENABLE ROW LEVEL SECURITY;

-- Authenticated staff: read any message belonging to their tenant.
CREATE POLICY order_messages_select_tenant
  ON order_messages FOR SELECT
  USING (tenant_id = auth.tenant_id());

-- Authenticated staff: reply on any order in their tenant.
-- sender_type must be 'staff' and sender_user_id must match the caller.
-- Customer-side inserts go through the service-role admin client in a server
-- action that validates tracking_id — bypassing RLS is intentional on that
-- path, not a hole in this policy.
CREATE POLICY order_messages_insert_staff_reply
  ON order_messages FOR INSERT
  WITH CHECK (
    tenant_id = auth.tenant_id()
    AND sender_type = 'staff'
    AND sender_user_id = auth.uid()
  );

-- Staff can mark messages read (only the read flag on their tenant's rows).
CREATE POLICY order_messages_update_mark_read
  ON order_messages FOR UPDATE
  USING (tenant_id = auth.tenant_id())
  WITH CHECK (tenant_id = auth.tenant_id());

-- No delete policy — messages are an audit record.

COMMENT ON TABLE order_messages IS
  'Customer ↔ jeweller thread on a repair or bespoke job. Customer-side posts via /track tracking_id flow (service-role, validated in action). Staff-side via auth.tenant_id() RLS.';
