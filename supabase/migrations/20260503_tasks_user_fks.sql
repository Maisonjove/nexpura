-- tasks.assigned_to / created_by foreign keys — Group 14 audit.
--
-- Why: /tasks/[id] embeds assignee + creator via PostgREST embed syntax
-- (`assignee:assigned_to(full_name, avatar_url)`). PostgREST resolves
-- those embeds through the foreign-key graph; without an FK the query
-- errors with PGRST200 "Could not find a relationship". The page
-- catches the null `task` and calls notFound() — every task detail
-- page has been returning 404 since the page was first built.
--
-- The columns themselves were already populated correctly (every
-- existing assigned_to / created_by points at a real users row — orphan
-- count = 0 at the time this migration was written), so adding the
-- constraints validates without any data fix needed.
--
-- ON DELETE behaviour:
--   assigned_to → SET NULL: deleting a user shouldn't cascade-delete
--     their assigned tasks; the work might still be needed.
--   created_by → SET NULL: same — preserve audit trail of the task
--     even if the creator's account is removed.

-- Schema-qualified `public.users` is critical: without the schema prefix
-- Postgres resolves `users` against the search_path which on this project
-- includes `auth` ahead of `public` in some session contexts, so an
-- unqualified `users` reference can land on auth.users instead. PostgREST
-- only exposes the `public` schema by default — an FK pointing at
-- auth.users renders the embed unresolvable from the API surface.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tasks_assigned_to_fkey'
      AND table_name = 'tasks'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_assigned_to_fkey
      FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tasks_created_by_fkey'
      AND table_name = 'tasks'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Tell PostgREST to reload its schema cache so the new FKs are
-- discoverable as embed targets without waiting on the periodic refresh.
NOTIFY pgrst, 'reload schema';

-- Helpful indexes for the FK checks (Postgres needs an index on the
-- referencing column to avoid sequential scans on parent-row deletes).
CREATE INDEX IF NOT EXISTS tasks_assigned_to_idx ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS tasks_created_by_idx ON tasks(created_by);
