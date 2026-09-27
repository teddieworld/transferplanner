INSERT INTO colleges (name)
VALUES ('Mt. San Antonio College')
ON CONFLICT (name) DO NOTHING;

INSERT INTO courses(
    college_id,
    code,
    title,
    min_units,
    max_units,
    uc_transferable,
    csu_transferable,
    description
)
VALUES(
    1,
    'CSCI 110',
    'Intro to CS',
    3.5,
    3.5,
    TRUE,
    TRUE,
    'Intro to CS'
);