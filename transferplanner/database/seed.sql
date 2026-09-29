INSERT INTO colleges (name)
VALUES ('Mt. San Antonio College')
ON CONFLICT (name) DO NOTHING;

INSERT INTO universities (name)
VALUES 
    ('University of California, Los Angeles'),
    ('University of California, Berkeley'),
    ('University of California, San Diego')
ON CONFLICT (name) DO NOTHING;
