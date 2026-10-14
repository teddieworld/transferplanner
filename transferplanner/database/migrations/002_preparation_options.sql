-- Reviewed Berkeley CS 2026–2027 major-preparation exception.
-- Original equivalence options remain unchanged. All changes are transactional.
BEGIN;

ALTER TABLE major_requirements ADD COLUMN IF NOT EXISTS preparation_note TEXT;
ALTER TABLE major_requirement_options
    ADD COLUMN IF NOT EXISTS option_kind TEXT NOT NULL DEFAULT 'equivalence';

DO $$
DECLARE constraint_row RECORD;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = 'major_requirement_options'::regclass
                     AND conname = 'major_requirement_option_kind_check') THEN
        ALTER TABLE major_requirement_options
            ADD CONSTRAINT major_requirement_option_kind_check
            CHECK (option_kind IN ('equivalence', 'preparation'));
    END IF;
    FOR constraint_row IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'major_requirement_options'::regclass AND contype = 'u'
          AND pg_get_constraintdef(oid) = 'UNIQUE (major_requirement_id, option_number)'
    LOOP
        EXECUTE format('ALTER TABLE major_requirement_options DROP CONSTRAINT %I', constraint_row.conname);
    END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS requirement_option_kind_unique
    ON major_requirement_options (major_requirement_id, option_kind, option_number);

DO $$
DECLARE
    target_id INTEGER;
    college_id_value INTEGER;
    equivalence_options JSONB;
    option_rule RECORD;
    preparation_option_id INTEGER;
    course_id_value INTEGER;
BEGIN
    SELECT r.id, a.college_id INTO target_id, college_id_value
    FROM major_requirements r
    JOIN major_requirement_groups g ON g.id = r.group_id
    JOIN articulation_agreements a ON a.id = g.agreement_id
    JOIN majors m ON m.id = a.major_id
    JOIN universities u ON u.id = m.university_id
    JOIN colleges c ON c.id = a.college_id
    WHERE u.name = 'University of California, Berkeley'
      AND m.name = 'Computer Science, B.A.'
      AND c.name = 'Mt. San Antonio College'
      AND a.academic_year = '2026–2027'
      AND r.requirement_text = 'MATH 54'
      AND g.requirement_category = 'required' AND g.group_name = 'B';

    IF target_id IS NULL THEN
        RAISE EXCEPTION 'The reviewed Berkeley CS 2026–2027 MATH 54 requirement was not found';
    END IF;

    SELECT jsonb_agg(item.courses ORDER BY item.option_number) INTO equivalence_options
    FROM (
        SELECT o.option_number, jsonb_agg(c.code ORDER BY c.code) AS courses
        FROM major_requirement_options o
        JOIN major_requirement_option_courses oc ON oc.option_id = o.id
        JOIN courses c ON c.id = oc.course_id AND c.college_id = college_id_value
        WHERE o.major_requirement_id = target_id AND o.option_kind = 'equivalence'
        GROUP BY o.id, o.option_number
    ) item;
    IF equivalence_options IS DISTINCT FROM
       '[["ENGR 285"],["MATH 285"],["MATH 260","MATH 290"]]'::jsonb THEN
        RAISE EXCEPTION 'MATH 54 mappings differ from the reviewed source; no preparation exception applied';
    END IF;

    UPDATE major_requirements
    SET preparation_note = 'Computer Science does not require full equivalence to Math 54 and will accept just the Linear Algebra course of an articulated Math 54-equivalent series.'
    WHERE id = target_id;

    FOR option_rule IN SELECT * FROM (VALUES
        (1, 'ENGR 285'), (2, 'MATH 285'), (3, 'MATH 260')
    ) AS rules(option_number, course_code)
    LOOP
        SELECT id INTO course_id_value FROM courses
        WHERE college_id = college_id_value AND code = option_rule.course_code;
        IF course_id_value IS NULL THEN
            RAISE EXCEPTION 'Preparation course % is missing from the catalog', option_rule.course_code;
        END IF;
        INSERT INTO major_requirement_options (major_requirement_id, option_kind, option_number)
        VALUES (target_id, 'preparation', option_rule.option_number)
        ON CONFLICT (major_requirement_id, option_kind, option_number)
        DO UPDATE SET option_kind = EXCLUDED.option_kind
        RETURNING id INTO preparation_option_id;
        INSERT INTO major_requirement_option_courses (option_id, course_id)
        VALUES (preparation_option_id, course_id_value)
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

COMMIT;
