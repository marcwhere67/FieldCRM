-- ============================================================
-- Observability: error_events log  —  2026-07-18
-- ============================================================
-- Durable capture for money/auth-critical failures (see src/lib/monitor.ts).
-- Writes are service-role only (RLS blocks the user clients); managers can
-- read their own org's errors for the Settings → System Health view.
-- Non-destructive, reversible (rollback at the bottom).
-- ============================================================

CREATE TABLE IF NOT EXISTS error_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  level text NOT NULL DEFAULT 'error' CHECK (level IN ('warning','error','critical')),
  source text NOT NULL,
  message text NOT NULL,
  stack text,
  org_id uuid REFERENCES organisations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  context jsonb DEFAULT '{}',
  resolved boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_error_events_org_created ON error_events (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_events_level       ON error_events (level, created_at DESC);

ALTER TABLE error_events ENABLE ROW LEVEL SECURITY;

-- Read: managers/admins of the owning org. No INSERT/UPDATE/DELETE policies →
-- only the service client (which bypasses RLS) can write, exactly as intended.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'error_events'
      AND policyname = 'managers read org errors'
  ) THEN
    CREATE POLICY "managers read org errors" ON error_events
      FOR SELECT
      USING (org_id = (SELECT auth_user_org_id()) AND (SELECT auth_is_manager()));
  END IF;
END $$;


-- ============================================================
-- ROLLBACK (paste to undo)
-- ============================================================
-- DROP POLICY IF EXISTS "managers read org errors" ON error_events;
-- DROP INDEX IF EXISTS idx_error_events_org_created;
-- DROP INDEX IF EXISTS idx_error_events_level;
-- DROP TABLE IF EXISTS error_events;
