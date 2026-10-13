-- Attach the existing Berkeley requirements to their known college and year.
-- Run once against an existing database. All changes are transactional.
BEGIN;

CREATE TABLE IF NOT EXISTS articulation_agreements (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    major_id INTEGER NOT NULL REFERENCES majors(id),
    college_id INTEGER NOT NULL REFERENCES colleges(id),
    academic_year TEXT NOT NULL,
    UNIQUE (major_id, college_id, academic_year)
);

INSERT INTO articulation_agreements (major_id, college_id, academic_year)
SELECT m.id, c.id, '2026–2027'
FROM majors m
JOIN universities u ON u.id = m.university_id
CROSS JOIN colleges c
WHERE u.name = 'University of California, Berkeley'
  AND m.name = 'Computer Science, B.A.'
  AND c.name = 'Mt. San Antonio College'
ON CONFLICT (major_id, college_id, academic_year) DO NOTHING;

ALTER TABLE major_requirement_groups
    ADD COLUMN IF NOT EXISTS agreement_id INTEGER REFERENCES articulation_agreements(id);

UPDATE major_requirement_groups g
SET agreement_id = a.id
FROM articulation_agreements a
JOIN majors m ON m.id = a.major_id
JOIN universities u ON u.id = m.university_id
JOIN colleges c ON c.id = a.college_id
WHERE g.major_id = a.major_id
  AND g.agreement_id IS NULL
  AND u.name = 'University of California, Berkeley'
  AND m.name = 'Computer Science, B.A.'
  AND c.name = 'Mt. San Antonio College'
  AND a.academic_year = '2026–2027';

-- Do not guess a year or college for any other existing requirements.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM major_requirement_groups WHERE agreement_id IS NULL) THEN
        RAISE EXCEPTION 'Some groups have no known agreement. Assign their college/year before migrating.';
    END IF;
    IF EXISTS (SELECT 1 FROM major_requirements WHERE group_id IS NULL) THEN
        RAISE EXCEPTION 'Assign every requirement to a group before migrating.';
    END IF;
END $$;

ALTER TABLE major_requirement_groups ALTER COLUMN agreement_id SET NOT NULL;
ALTER TABLE major_requirements ALTER COLUMN group_id SET NOT NULL;

-- Replace the old per-major uniqueness rules with per-agreement/group rules.
-- Identify constraints by their columns; development DBs used different names.
DO $$
DECLARE constraint_row RECORD;
BEGIN
    FOR constraint_row IN
        SELECT conrelid::regclass AS table_name, conname
        FROM pg_constraint
        WHERE contype = 'u' AND (
            (conrelid = 'major_requirement_groups'::regclass
             AND pg_get_constraintdef(oid) = 'UNIQUE (major_id, requirement_category, group_name)')
            OR
            (conrelid = 'major_requirements'::regclass
             AND pg_get_constraintdef(oid) = 'UNIQUE (major_id, requirement_text, requirement_category)')
        )
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', constraint_row.table_name, constraint_row.conname);
    END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS agreement_group_unique
    ON major_requirement_groups (agreement_id, requirement_category, group_name);
CREATE UNIQUE INDEX IF NOT EXISTS group_requirement_unique
    ON major_requirements (group_id, requirement_text);

COMMIT;
