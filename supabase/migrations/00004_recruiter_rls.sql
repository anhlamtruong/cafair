-- ============================================================================
-- RLS Policies for Recruiter Tables
--
-- All tables use auth.user_id() (Clerk JWT → Supabase RLS).
-- "evidence" has no direct user_id, so access is derived via candidates.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. EVENTS
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Recruiters can read events they created
CREATE POLICY "events_select_own"
  ON events FOR SELECT
  USING (user_id = auth.user_id());

-- Recruiters can create events
CREATE POLICY "events_insert_own"
  ON events FOR INSERT
  WITH CHECK (user_id = auth.user_id());

-- Recruiters can update their own events
CREATE POLICY "events_update_own"
  ON events FOR UPDATE
  USING (user_id = auth.user_id());

-- Recruiters can delete their own events
CREATE POLICY "events_delete_own"
  ON events FOR DELETE
  USING (user_id = auth.user_id());


-- ────────────────────────────────────────────────────────────────────────────
-- 2. JOB_ROLES
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE job_roles ENABLE ROW LEVEL SECURITY;

-- Recruiters can read roles they created
CREATE POLICY "job_roles_select_own"
  ON job_roles FOR SELECT
  USING (user_id = auth.user_id());

-- Recruiters can create roles
CREATE POLICY "job_roles_insert_own"
  ON job_roles FOR INSERT
  WITH CHECK (user_id = auth.user_id());

-- Recruiters can update their own roles
CREATE POLICY "job_roles_update_own"
  ON job_roles FOR UPDATE
  USING (user_id = auth.user_id());

-- Recruiters can delete their own roles
CREATE POLICY "job_roles_delete_own"
  ON job_roles FOR DELETE
  USING (user_id = auth.user_id());


-- ────────────────────────────────────────────────────────────────────────────
-- 3. CANDIDATES
--    Both user_id (creator) and owner_id (assigned recruiter) grant access.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

-- Readable by creator OR assigned recruiter
CREATE POLICY "candidates_select_own"
  ON candidates FOR SELECT
  USING (
    user_id = auth.user_id()
    OR owner_id = auth.user_id()
  );

-- Only the creator can insert
CREATE POLICY "candidates_insert_own"
  ON candidates FOR INSERT
  WITH CHECK (user_id = auth.user_id());

-- Creator or assigned recruiter can update
CREATE POLICY "candidates_update_own"
  ON candidates FOR UPDATE
  USING (
    user_id = auth.user_id()
    OR owner_id = auth.user_id()
  );

-- Only the creator can delete
CREATE POLICY "candidates_delete_own"
  ON candidates FOR DELETE
  USING (user_id = auth.user_id());


-- ────────────────────────────────────────────────────────────────────────────
-- 4. EVIDENCE
--    No direct user_id — access derived through candidates.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

-- Readable if user owns the parent candidate
CREATE POLICY "evidence_select_via_candidate"
  ON evidence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = evidence.candidate_id
        AND (c.user_id = auth.user_id() OR c.owner_id = auth.user_id())
    )
  );

-- Insertable if user owns the parent candidate
CREATE POLICY "evidence_insert_via_candidate"
  ON evidence FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = evidence.candidate_id
        AND c.user_id = auth.user_id()
    )
  );

-- Updatable if user owns the parent candidate
CREATE POLICY "evidence_update_via_candidate"
  ON evidence FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = evidence.candidate_id
        AND (c.user_id = auth.user_id() OR c.owner_id = auth.user_id())
    )
  );

-- Deletable if user created the parent candidate
CREATE POLICY "evidence_delete_via_candidate"
  ON evidence FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = evidence.candidate_id
        AND c.user_id = auth.user_id()
    )
  );


-- ────────────────────────────────────────────────────────────────────────────
-- 5. RECRUITER_ACTIONS
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE recruiter_actions ENABLE ROW LEVEL SECURITY;

-- Recruiters can read their own actions
CREATE POLICY "recruiter_actions_select_own"
  ON recruiter_actions FOR SELECT
  USING (user_id = auth.user_id());

-- Recruiters can create actions
CREATE POLICY "recruiter_actions_insert_own"
  ON recruiter_actions FOR INSERT
  WITH CHECK (user_id = auth.user_id());

-- Recruiters can update their own actions
CREATE POLICY "recruiter_actions_update_own"
  ON recruiter_actions FOR UPDATE
  USING (user_id = auth.user_id());

-- Recruiters can delete their own actions
CREATE POLICY "recruiter_actions_delete_own"
  ON recruiter_actions FOR DELETE
  USING (user_id = auth.user_id());


-- ────────────────────────────────────────────────────────────────────────────
-- Performance indexes for RLS subqueries
-- ────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_job_roles_user_id ON job_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_candidates_user_id ON candidates(user_id);
CREATE INDEX IF NOT EXISTS idx_candidates_owner_id ON candidates(owner_id);
CREATE INDEX IF NOT EXISTS idx_evidence_candidate_id ON evidence(candidate_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_actions_user_id ON recruiter_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_actions_candidate_id ON recruiter_actions(candidate_id);
