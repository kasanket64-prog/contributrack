/*
  # Multi-Tenant Workspaces, Server-Persisted Calibration/Actions, and Signed Credentials

  ## 1. Workspaces & Membership
  - `workspaces`: isolated tenant containers storing `plan_tier`, billing links, Stripe customer ID, and fairness method.
  - `workspace_members`: maps authenticated `auth.users` to workspaces with roles (`owner`, `admin`, `member`).
  - `is_workspace_member(ws_id uuid)`: SQL helper for Row-Level Security (RLS) policies.

  ## 2. Tenant-Scoped Columns
  - Adds `workspace_id` + indexes to `members`, `sessions`, `iot_data`, `documents`, and `ai_insights`.

  ## 3. Server-Persisted Workspace Features & Tamper-Evident Credentials
  - `peer_reviews`: persists 360° offline peer calibration ratings & notes per `(workspace_id, member_id)`.
  - `session_actions`: persists AI Session Brief action item completion per `(workspace_id, session_id, action_key)`.
  - `contribution_certificates`: stores HMAC-SHA256 signed credentials (`credential_id`, `payload`, `signature`, `algorithm`) with public read verification by `credential_id`.
*/

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  plan_tier text NOT NULL DEFAULT 'pro' CHECK (plan_tier IN ('starter', 'pro', 'enterprise')),
  stripe_pro_url text NOT NULL DEFAULT '',
  stripe_enterprise_url text NOT NULL DEFAULT '',
  stripe_customer_id text,
  fairness_method text NOT NULL DEFAULT 'stddev' CHECK (fairness_method IN ('stddev', 'gini', 'range')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

-- Seed default multi-cohort workspaces idempotently
INSERT INTO workspaces (id, name, slug, plan_tier)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'Capstone Cohort A', 'capstone-cohort-a', 'pro'),
  ('00000000-0000-4000-8000-000000000002', 'AI Robotics Lab', 'ai-robotics-lab', 'pro'),
  ('00000000-0000-4000-8000-000000000003', 'Product Sprint Squad', 'product-sprint-squad', 'starter')
ON CONFLICT (slug) DO NOTHING;

-- Helper used by RLS policies
CREATE OR REPLACE FUNCTION is_workspace_member(ws_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  );
$$;

-- Scope existing domain tables by workspace_id
ALTER TABLE members ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE iot_data ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE ai_insights ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

UPDATE members SET workspace_id = '00000000-0000-4000-8000-000000000001' WHERE workspace_id IS NULL;
UPDATE sessions SET workspace_id = '00000000-0000-4000-8000-000000000001' WHERE workspace_id IS NULL;
UPDATE iot_data SET workspace_id = '00000000-0000-4000-8000-000000000001' WHERE workspace_id IS NULL;
UPDATE documents SET workspace_id = '00000000-0000-4000-8000-000000000001' WHERE workspace_id IS NULL;
UPDATE ai_insights SET workspace_id = '00000000-0000-4000-8000-000000000001' WHERE workspace_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_members_workspace ON members (workspace_id);
CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions (workspace_id);
CREATE INDEX IF NOT EXISTS idx_iot_data_workspace ON iot_data (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents (workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_workspace ON ai_insights (workspace_id);

-- 360° Peer Reviews (replaces localStorage persistence)
CREATE TABLE IF NOT EXISTS peer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, member_id)
);

-- AI Session Action Items (replaces localStorage persistence)
CREATE TABLE IF NOT EXISTS session_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  action_key text NOT NULL,
  label text NOT NULL DEFAULT '',
  done boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, session_id, action_key)
);

-- HMAC-SHA256 Signed Proof-of-Contribution Certificates
CREATE TABLE IF NOT EXISTS contribution_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id text UNIQUE NOT NULL,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  workspace_name text NOT NULL,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  member_name text NOT NULL,
  payload jsonb NOT NULL,
  signature text NOT NULL,
  algorithm text NOT NULL DEFAULT 'HMAC-SHA256',
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS across new tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE peer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contribution_certificates ENABLE ROW LEVEL SECURITY;

-- Workspace policies
CREATE POLICY "Authenticated read joined workspaces"
  ON workspaces FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR is_workspace_member(id) OR NOT EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = workspaces.id));

CREATE POLICY "Authenticated create workspace"
  ON workspaces FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated update workspace"
  ON workspaces FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR is_workspace_member(id) OR NOT EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = workspaces.id))
  WITH CHECK (true);

-- Workspace member mapping
CREATE POLICY "Authenticated manage workspace_members"
  ON workspace_members FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_workspace_member(workspace_id))
  WITH CHECK (user_id = auth.uid() OR is_workspace_member(workspace_id));

-- Peer reviews & session actions
CREATE POLICY "Authenticated manage peer_reviews"
  ON peer_reviews FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated manage session_actions"
  ON session_actions FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Contribution certificates: authenticated read/write, plus public verification lookup by credential_id
CREATE POLICY "Public verify contribution_certificates"
  ON contribution_certificates FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated insert contribution_certificates"
  ON contribution_certificates FOR INSERT TO authenticated
  WITH CHECK (true);
