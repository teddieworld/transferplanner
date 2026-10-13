\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA transferplanner_schema_check;
SET LOCAL search_path TO transferplanner_schema_check;
\ir ../schema.sql
\ir ../seed.sql

INSERT INTO majors (university_id, name)
SELECT id, 'Computer Science, B.A.' FROM universities
WHERE name = 'University of California, Berkeley';

INSERT INTO articulation_agreements (major_id, college_id, academic_year)
SELECT m.id, c.id, year
FROM majors m CROSS JOIN colleges c
CROSS JOIN (VALUES ('2026–2027'), ('2027–2028')) AS years(year);

INSERT INTO major_requirement_groups (major_id, agreement_id, group_name, requirement_category, required_count)
SELECT major_id, id, 'A', 'required', NULL FROM articulation_agreements;

INSERT INTO major_requirements (major_id, group_id, requirement_text, requirement_category, articulation_status)
SELECT major_id, id, 'MATH 51', 'required', 'articulated' FROM major_requirement_groups;

DO $$
BEGIN
    IF (SELECT count(*) FROM major_requirements) <> 2 THEN
        RAISE EXCEPTION 'Different years must retain independent requirements';
    END IF;
END $$;

-- The entire check is rolled back, including the temporary schema.
ROLLBACK;
