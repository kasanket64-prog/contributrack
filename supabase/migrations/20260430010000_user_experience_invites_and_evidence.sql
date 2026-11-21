/*
  # User Experience: Shareable Invites (/join/:code) & Offline Evidence / Fairness Appeals

  ## 1. Tables
  - `workspace_invites`: shareable team/session invite codes resolved at `/join/:code`.
  - `contribution_evidence`: member-submitted offline contributions & score appeals
    with instructor review status (`pending`, `approved`, `needs_info`) and notes.

  ## 2. Security (RLS)
  - Public SELECT on `workspace_invites` so invited teammates can inspect workspace details
    before authenticating on `/join/:code`.
  - Authenticated management on `workspace_invites` and `contribution_evidence`.
*/

CREATE TABLE IF NOT EXISTS workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  code text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_by text NOT NULL DEFAULT '',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace ON workspace_invites (workspace_id);

INSERT INTO workspace_invites (workspace_id, code, role, created_by)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'CAPSTONE-A', 'member', 'system'),
  ('00000000-0000-4000-8000-000000000002', 'ROBOTICS-LAB', 'member', 'system'),
  ('00000000-0000-4000-8000-000000000003', 'SPRINT-SQ', 'member', 'system')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS contribution_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('hardware', 'design', 'code', 'research', 'facilitation')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  evidence_url text NOT NULL DEFAULT '',
  hours numeric(5,2) NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'needs_info')),
  reviewer_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contribution_evidence_workspace ON contribution_evidence (workspace_id, created_at DESC);

ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE contribution_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read workspace_invites"
  ON workspace_invites FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated manage workspace_invites"
  ON workspace_invites FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated manage contribution_evidence"
  ON contribution_evidence FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
