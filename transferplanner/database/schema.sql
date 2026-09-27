CREATE TABLE IF NOT EXISTS colleges(
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

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

CREATE TABLE IF NOT EXISTS course_requirements(
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    requirement_type TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    UNIQUE(course_id, requirement_type, raw_text)
);

CREATE TABLE IF NOT EXISTS requirement_courses(
    requirement_id INTEGER NOT NULL REFERENCES course_requirements(id),
    referenced_course_id INTEGER NOT NULL REFERENCES courses(id),
    PRIMARY KEY(requirement_id, referenced_course_id)
);