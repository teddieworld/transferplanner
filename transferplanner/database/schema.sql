CREATE TABLE IF NOT EXISTS colleges(
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);
--Represents different community colleges

CREATE TABLE IF NOT EXISTS courses(
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    college_id INTEGER NOT NULL REFERENCES colleges(id),
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    min_units NUMERIC NOT NULL,
    max_units NUMERIC NOT NULL,
    uc_transferable BOOLEAN NOT NULL,
    csu_transferable BOOLEAN NOT NULL,
    description TEXT,
    UNIQUE (college_id, code)
);
--Represents different courses at each CCC with a foreign key to each college_id

CREATE TABLE IF NOT EXISTS course_requirements(
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    requirement_type TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    UNIQUE(course_id, requirement_type, raw_text)
);
--Requirements for taking a course at a CC with a foreign key to that course
--Connects a course to its requirements

CREATE TABLE IF NOT EXISTS requirement_courses(
    requirement_id INTEGER NOT NULL REFERENCES course_requirements(id),
    referenced_course_id INTEGER NOT NULL REFERENCES courses(id),
    PRIMARY KEY(requirement_id, referenced_course_id)
);
--connects a requirement to the invidivual courses inside of it

CREATE TABLE IF NOT EXISTS universities(
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    UNIQUE(name)
);
--different transfer destinations for universities

CREATE TABLE IF NOT EXISTS majors(
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    university_id INTEGER NOT NULL REFERENCES universities(id),
    name TEXT NOT NULL,
    UNIQUE(university_id, name)
);
--majors at each respective university

CREATE TABLE IF NOT EXISTS articulation_agreements(
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    major_id INTEGER NOT NULL REFERENCES majors(id),
    college_id INTEGER NOT NULL REFERENCES colleges(id),
    academic_year TEXT NOT NULL,
    UNIQUE(major_id, college_id, academic_year)
);
--One articulation agreement for a major, starting college, and academic year.

CREATE TABLE IF NOT EXISTS major_requirement_groups(
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    major_id INTEGER NOT NULL REFERENCES majors(id),
    agreement_id INTEGER NOT NULL REFERENCES articulation_agreements(id),
    group_name TEXT NOT NULL,
    requirement_category TEXT NOT NULL,
    required_count INTEGER,
    UNIQUE(agreement_id, requirement_category, group_name)
);
--Groups must exist before major_requirements can reference them.

CREATE TABLE IF NOT EXISTS major_requirements(
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    major_id INTEGER NOT NULL REFERENCES majors(id),
    requirement_text TEXT NOT NULL,
    requirement_category TEXT NOT NULL,
    articulation_status TEXT NOT NULL,
    note TEXT,
    preparation_note TEXT,
    group_id INTEGER NOT NULL REFERENCES major_requirement_groups(id),
    UNIQUE(group_id, requirement_text)
);
--major requirement for a particular university major

CREATE TABLE IF NOT EXISTS major_requirement_options(
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    major_requirement_id INTEGER NOT NULL REFERENCES major_requirements(id),
    option_kind TEXT NOT NULL DEFAULT 'equivalence' CHECK (option_kind IN ('equivalence', 'preparation')),
    option_number INTEGER NOT NULL,
    UNIQUE(major_requirement_id, option_kind, option_number)
);
--stores different options for satisfying a major requirement

CREATE TABLE IF NOT EXISTS major_requirement_option_courses(
    option_id INTEGER REFERENCES major_requirement_options(id),
    course_id INTEGER REFERENCES courses(id),
    PRIMARY KEY (option_id, course_id)
);
--takes the option groups from major_requirement_options and store the actual courses
