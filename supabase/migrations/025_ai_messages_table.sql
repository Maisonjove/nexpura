-- Migration: Add ai_messages table and title column to ai_conversations
-- Required by the AI Copilot chat route which uses a separate messages table

-- Add title column to ai_conversations if missing
ALTER TABLE public.ai_conversations ADD COLUMN IF NOT EXISTS title text;

-- Create ai_messages table
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  tokens_used integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON public.ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_tenant ON public.ai_messages(tenant_id);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_messages' AND policyname='ai_messages_select') THEN
    CREATE POLICY "ai_messages_select" ON public.ai_messages FOR SELECT USING (tenant_id = public.get_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_messages' AND policyname='ai_messages_insert') THEN
    CREATE POLICY "ai_messages_insert" ON public.ai_messages FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
  END IF;
END $$;
