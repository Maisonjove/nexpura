-- Migration 030: Customer Communications Log
-- Tracks all outbound communications sent to customers

create table if not exists customer_communications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  tenant_id uuid not null,
  type text not null, -- 'email_receipt' | 'invoice' | 'quote' | 'repair_ready' | 'stage_update' | 'whatsapp'
  subject text,
  sent_at timestamptz not null default now(),
  sent_by uuid references auth.users(id) on delete set null,
  reference_type text, -- 'invoice' | 'repair' | 'quote' | 'bespoke_job'
  reference_id uuid,
  metadata jsonb -- extra context: email address sent to, etc.
);

-- RLS
alter table customer_communications enable row level security;

create policy "Tenant members can read own communications"
  on customer_communications for select
  using (tenant_id = (select tenant_id from users where id = auth.uid()));

create policy "Tenant members can insert communications"
  on customer_communications for insert
  with check (tenant_id = (select tenant_id from users where id = auth.uid()));

-- Service role has full access (for server-side inserts via admin client)
create policy "Service role full access"
  on customer_communications for all
  using (auth.role() = 'service_role');

-- Indexes
create index if not exists idx_customer_comms_customer_id on customer_communications(customer_id);
create index if not exists idx_customer_comms_tenant_id on customer_communications(tenant_id);
create index if not exists idx_customer_comms_sent_at on customer_communications(sent_at desc);
