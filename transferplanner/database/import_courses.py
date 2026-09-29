import psycopg
import json

def connect_to_database():
    connection = psycopg.connect("dbname = transferplanner")
    return connection
def insert_course(cursor, course, college_id):
    query = """
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
        %s,
        %s,
        %s,
        %s,
        %s,
        %s,
        %s,
        %s
    )
    ON CONFLICT(college_id, code)
    DO NOTHING
    """
    values = (
        college_id,
        course["code"],
        course["title"],
        course["minimum_units"],
        course["maximum_units"],
        course["uc_transferable"],
        course["csu_transferable"],
        course["description"],
    )
    cursor.execute(query, values)
def load_courses_json(filepath):
    with open(filepath, mode="r") as file:
        courses = json.load(file)
    return courses
def get_course_id(cursor, college_id, course_code):
    query = """
        SELECT id
        FROM courses
        WHERE college_id = %s
        AND code = %s
    """
    values = (
        college_id,
        course_code
    )
    cursor.execute(query, values)
    result = cursor.fetchone() #fetchone returns a tuple of all values that match
    if result:
        return result[0]
    return None
def insert_requirement(cursor, course_id, requirement):
    query = """
        INSERT INTO course_requirements(
            course_id,
            requirement_type,
            raw_text
        )
        VALUES(
            %s,
            %s,
            %s
        )
        ON CONFLICT(course_id, requirement_type, raw_text)
        DO NOTHING
        RETURNING id;
    """
    values = (
        course_id,
        requirement["type"],
        requirement["raw"]
    )
    cursor.execute(query, values)
    result = cursor.fetchone()
    if result:
        return result[0]
    return get_requirement_id(cursor, course_id, requirement)
def get_requirement_id(cursor, course_id, requirement):
    query = """
        SELECT id
        FROM course_requirements
        WHERE course_id = %s
        AND requirement_type = %s
        AND raw_text=%s;
    """
    values = (
        course_id,
        requirement["type"],
        requirement["raw"]
    )
    cursor.execute(query, values)
    result = cursor.fetchone()
    if result:
        return result[0]
    return None
def insert_requirement_course(cursor, requirement_id, referenced_course_id):
    query = """
        INSERT INTO requirement_courses(
            requirement_id,
            referenced_course_id
        )
        VALUES(
            %s,
            %s
        )
        ON CONFLICT (requirement_id, referenced_course_id)
        DO NOTHING
    """
    values = (
        requirement_id,
        referenced_course_id
    )
    cursor.execute(query,values)
    

connection = connect_to_database()
#connects to the database
cursor = connection.cursor()
#creates a cursor

courses = load_courses_json("transferplanner/data/mtsac_courses.json")
#returns a list of dictionaries

for course in courses:
    insert_course(cursor, course, 1) #executes the insert command into courses database
    course_id = get_course_id(cursor, 1, course["code"])
    for requirement in course["requirements"]:

        requirement_id = insert_requirement(cursor, course_id, requirement)

        for course_code in requirement["courses"]:

            referenced_course_id = get_course_id(cursor, 1, course_code)

            if referenced_course_id:
                insert_requirement_course(cursor, requirement_id, referenced_course_id)

connection.commit()
#commits changes
