-- ════════════════════════════════════════════════════════════════════════
-- Migration: Package Management tables
-- 7 tables + RLS policies + indexes for candidate application packages.
-- Depends on: get_user_id() function from 00001_initial_schema.sql
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. candidate_packages ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS candidate_packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  parse_status TEXT NOT NULL DEFAULT 'idle',
  resume_url TEXT,
  resume_file_name TEXT,
  completion_percentage INTEGER NOT NULL DEFAULT 0,
  ai_role_title TEXT,
  ai_summary TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE candidate_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own packages" ON candidate_packages
  FOR SELECT USING (user_id = get_user_id());
CREATE POLICY "Users can insert own packages" ON candidate_packages
  FOR INSERT WITH CHECK (user_id = get_user_id());
CREATE POLICY "Users can update own packages" ON candidate_packages
  FOR UPDATE USING (user_id = get_user_id());
CREATE POLICY "Users can delete own packages" ON candidate_packages
  FOR DELETE USING (user_id = get_user_id());

CREATE INDEX IF NOT EXISTS idx_candidate_packages_user_id
  ON candidate_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_candidate_packages_status
  ON candidate_packages(status);
CREATE INDEX IF NOT EXISTS idx_candidate_packages_user_status
  ON candidate_packages(user_id, status);

-- ── 2. package_experiences ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS package_experiences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES candidate_packages(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  role_title TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE package_experiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own package experiences" ON package_experiences
  FOR SELECT USING (package_id IN (SELECT id FROM candidate_packages WHERE user_id = get_user_id()));
CREATE POLICY "Users can insert own package experiences" ON package_experiences
  FOR INSERT WITH CHECK (package_id IN (SELECT id FROM candidate_packages WHERE user_id = get_user_id()));
CREATE POLICY "Users can update own package experiences" ON package_experiences
  FOR UPDATE USING (package_id IN (SELECT id FROM candidate_packages WHERE user_id = get_user_id()));
CREATE POLICY "Users can delete own package experiences" ON package_experiences
  FOR DELETE USING (package_id IN (SELECT id FROM candidate_packages WHERE user_id = get_user_id()));

CREATE INDEX IF NOT EXISTS idx_package_experiences_package_id
  ON package_experiences(package_id);

-- ── 3. package_skills ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS package_skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES candidate_packages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE package_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own package skills" ON package_skills
  FOR SELECT USING (package_id IN (SELECT id FROM candidate_packages WHERE user_id = get_user_id()));
CREATE POLICY "Users can insert own package skills" ON package_skills
  FOR INSERT WITH CHECK (package_id IN (SELECT id FROM candidate_packages WHERE user_id = get_user_id()));
CREATE POLICY "Users can update own package skills" ON package_skills
  FOR UPDATE USING (package_id IN (SELECT id FROM candidate_packages WHERE user_id = get_user_id()));
CREATE POLICY "Users can delete own package skills" ON package_skills
  FOR DELETE USING (package_id IN (SELECT id FROM candidate_packages WHERE user_id = get_user_id()));

CREATE INDEX IF NOT EXISTS idx_package_skills_package_id
  ON package_skills(package_id);

-- ── 4. package_education ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS package_education (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES candidate_packages(id) ON DELETE CASCADE,
  institution TEXT NOT NULL,
  degree TEXT,
  field_of_study TEXT,
  start_date TEXT,
  end_date TEXT,
  ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE package_education ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own package education" ON package_education
  FOR SELECT USING (package_id IN (SELECT id FROM candidate_packages WHERE user_id = get_user_id()));
CREATE POLICY "Users can insert own package education" ON package_education
  FOR INSERT WITH CHECK (package_id IN (SELECT id FROM candidate_packages WHERE user_id = get_user_id()));
CREATE POLICY "Users can update own package education" ON package_education
  FOR UPDATE USING (package_id IN (SELECT id FROM candidate_packages WHERE user_id = get_user_id()));
CREATE POLICY "Users can delete own package education" ON package_education
  FOR DELETE USING (package_id IN (SELECT id FROM candidate_packages WHERE user_id = get_user_id()));

CREATE INDEX IF NOT EXISTS idx_package_education_package_id
  ON package_education(package_id);

-- ── 5. package_certifications ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS package_certifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES candidate_packages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  issuer TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE package_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own package certifications" ON package_certifications
  FOR SELECT USING (package_id IN (SELECT id FROM candidate_packages WHERE user_id = get_user_id()));
CREATE POLICY "Users can insert own package certifications" ON package_certifications
  FOR INSERT WITH CHECK (package_id IN (SELECT id FROM candidate_packages WHERE user_id = get_user_id()));
CREATE POLICY "Users can update own package certifications" ON package_certifications
  FOR UPDATE USING (package_id IN (SELECT id FROM candidate_packages WHERE user_id = get_user_id()));
CREATE POLICY "Users can delete own package certifications" ON package_certifications
  FOR DELETE USING (package_id IN (SELECT id FROM candidate_packages WHERE user_id = get_user_id()));

CREATE INDEX IF NOT EXISTS idx_package_certifications_package_id
  ON package_certifications(package_id);

-- ── 6. package_preferences ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS package_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES candidate_packages(id) ON DELETE CASCADE,
  work_styles JSONB,
  company_sizes JSONB,
  comp_range_min INTEGER,
  comp_range_max INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT package_preferences_package_id_unique UNIQUE (package_id)
);

ALTER TABLE package_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own package preferences" ON package_preferences
  FOR SELECT USING (package_id IN (SELECT id FROM candidate_packages WHERE user_id = get_user_id()));
CREATE POLICY "Users can insert own package preferences" ON package_preferences
  FOR INSERT WITH CHECK (package_id IN (SELECT id FROM candidate_packages WHERE user_id = get_user_id()));
CREATE POLICY "Users can update own package preferences" ON package_preferences
  FOR UPDATE USING (package_id IN (SELECT id FROM candidate_packages WHERE user_id = get_user_id()));
CREATE POLICY "Users can delete own package preferences" ON package_preferences
  FOR DELETE USING (package_id IN (SELECT id FROM candidate_packages WHERE user_id = get_user_id()));

-- ── 7. package_role_targets ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS package_role_targets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES candidate_packages(id) ON DELETE CASCADE,
  role_title TEXT NOT NULL,
  ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE package_role_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own package role targets" ON package_role_targets
  FOR SELECT USING (package_id IN (SELECT id FROM candidate_packages WHERE user_id = get_user_id()));
CREATE POLICY "Users can insert own package role targets" ON package_role_targets
  FOR INSERT WITH CHECK (package_id IN (SELECT id FROM candidate_packages WHERE user_id = get_user_id()));
CREATE POLICY "Users can update own package role targets" ON package_role_targets
  FOR UPDATE USING (package_id IN (SELECT id FROM candidate_packages WHERE user_id = get_user_id()));
CREATE POLICY "Users can delete own package role targets" ON package_role_targets
  FOR DELETE USING (package_id IN (SELECT id FROM candidate_packages WHERE user_id = get_user_id()));

CREATE INDEX IF NOT EXISTS idx_package_role_targets_package_id
  ON package_role_targets(package_id);
