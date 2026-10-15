-- Preserve degree requirements, informational guidance, and reviewed group rules.
BEGIN;
ALTER TABLE articulation_agreements ADD COLUMN IF NOT EXISTS planner_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE major_requirement_groups ADD COLUMN IF NOT EXISTS rules JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE major_requirements ADD COLUMN IF NOT EXISTS department TEXT;
COMMIT;
