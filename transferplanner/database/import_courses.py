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
def get_university_id(cursor, university_name):
    query = """
        SELECT id
        FROM universities
        WHERE name = %s;
    """
    values = (
        university_name,
    )
    cursor.execute(query, values)
    result = cursor.fetchone()
    if result:
        return result[0]
    return None
def insert_major(cursor, university_id, major_name):
    query = """
        INSERT into majors(
            university_id,
            name
        )
        VALUES(
            %s,
            %s
        )
        ON CONFLICT(university_id, name)
        DO NOTHING
    """
    values = (
        university_id,
        major_name
    )
    cursor.execute(query, values)
def get_major_id(cursor, university_id, major_name):
    query = """
        SELECT id 
        FROM majors
        WHERE university_id = %s
        AND name = %s
    """
    values = (
        university_id,
        major_name
    )
    cursor.execute(query,values)
    result = cursor.fetchone()
    if result:
        return result[0]
    return None
def insert_major_requirement(cursor, major_id, requirement_text,requirement_category, articulation_status, note, group_id):
    query = """
        INSERT into major_requirements(
            major_id,
            requirement_text,
            requirement_category,
            articulation_status,
            note,
            group_id
        )
        VALUES(
            %s,
            %s,
            %s,
            %s,
            %s,
            %s
        )
        ON CONFLICT(major_id, requirement_text, requirement_category)
        DO NOTHING
    """
    values = (
        major_id,
        requirement_text,
        requirement_category,
        articulation_status,
        note,
        group_id
    )
    cursor.execute(query,values)
def get_major_requirement_id(cursor, major_id, requirement_text, requirement_category):
    query = """
        SELECT id
        FROM major_requirements
        WHERE major_id = %s
        AND requirement_text = %s
        AND requirement_category = %s;
    """
    values = (
        major_id,
        requirement_text,
        requirement_category
    )

    cursor.execute(query, values)
    result = cursor.fetchone()
    if result:
        return result[0]
    return None
def load_articulations_json(filepath):
    with open(filepath, mode="r") as file:
        articulations = json.load(file)
    return articulations
def insert_major_requirement_option(cursor, major_requirement_id, option_number):
    query = """
        INSERT into major_requirement_options(
            major_requirement_id,
            option_number
        )
        VALUES(
            %s,
            %s
        )
        ON CONFLICT(major_requirement_id, option_number)
        DO NOTHING
    """
    values = (
        major_requirement_id,
        option_number
    )
    cursor.execute(query,values)
def get_major_requirement_option_id(cursor, major_requirement_id, option_number):
    query = """
        SELECT id
        FROM major_requirement_options
        WHERE major_requirement_id = %s
        AND option_number = %s;
    """
    values = (
        major_requirement_id,
        option_number
    )
    cursor.execute(query, values)
    result = cursor.fetchone()
    if result:
        return result[0]
    return None
def insert_major_requirement_option_course(cursor, option_id, course_id):
    query = """
        INSERT into major_requirement_option_courses(
            option_id,
            course_id
        )
        VALUES(
            %s,
            %s
        )
        ON CONFLICT(option_id, course_id)
        DO NOTHING
    """
    values = (
        option_id,
        course_id
    )
    cursor.execute(query,values)
def insert_major_requirement_group(cursor, major_id, group_name, requirement_category, required_count):
    query = """
        INSERT into major_requirement_groups(
            major_id,
            group_name,
            requirement_category,
            required_count
        )
        VALUES(
            %s,
            %s,
            %s,
            %s
        )
        ON CONFLICT(major_id, requirement_category, group_name)
        DO NOTHING
    """
    values = (
        major_id,
        group_name,
        requirement_category,
        required_count
    )
    cursor.execute(query, values)
def get_major_requirement_group_id(cursor, major_id, requirement_category, group_name):
    query = """
        SELECT id
        FROM major_requirement_groups
        WHERE major_id = %s
        AND requirement_category = %s
        AND group_name = %s
    """
    values = (
        major_id,
        requirement_category,
        group_name
    )
    cursor.execute(query, values)
    result = cursor.fetchone()
    if result:
        return result[0]
    return None

def get_major_requirements(cursor, university_name, major_name):
    #queries SQL to give us the full corresponding courses for a university name and it's major
    query = """
        SELECT
        u.name,
        m.name,
        mrg.group_name,
        mrg.required_count,
        mr.requirement_text,
        mro.option_number,
        mr.requirement_category,
        mr.articulation_status,
        mr.note,
        c.code,
        c.title
        FROM universities u

        JOIN majors m
            ON m.university_id = u.id

        JOIN major_requirements mr
            ON mr.major_id = m.id

        LEFT JOIN major_requirement_options mro
            ON mro.major_requirement_id = mr.id

        LEFT JOIN major_requirement_groups mrg
            ON mr.group_id = mrg.id

        LEFT JOIN major_requirement_option_courses mroc
            ON mroc.option_id = mro.id

        LEFT JOIN courses c
            ON mroc.course_id = c.id

        WHERE u.name = %s
        AND m.name = %s;
    """
    #Selects the values that are joined together from the different datatables with corresponding foreign keys
    #gets the matching id for the parameter u.name and m.name and goes down the chain of foreign keys to find all corresponding data
    
    values = (
        university_name,
        major_name
    )
    cursor.execute(query, values)
    results = cursor.fetchall()
    return results

connection = connect_to_database()
#connects to the database
cursor = connection.cursor()
#creates a cursor

courses = load_courses_json("transferplanner/data/mtsac_courses.json")
#returns a list of dictionaries
articulations = load_articulations_json("transferplanner/data/berkeley_cs_2026_2027.json")

#catalog Mt.Sac course data
for course in courses:
    insert_course(cursor, course, 1) #executes the insert command into courses database
    course_id = get_course_id(cursor, 1, course["code"])
    for requirement in course["requirements"]:

        requirement_id = insert_requirement(cursor, course_id, requirement)

        for course_code in requirement["courses"]:

            referenced_course_id = get_course_id(cursor, 1, course_code)

            if referenced_course_id:
                insert_requirement_course(cursor, requirement_id, referenced_course_id)

university_name = articulations["university"]
university_id = get_university_id(cursor, university_name)

major_name = articulations["major"]

insert_major(cursor, university_id, major_name)
major_id = get_major_id(cursor, university_id, major_name)

#catalog major groups
for group in articulations["groups"]:
    insert_major_requirement_group(cursor, major_id, group["name"], group["category"], group["required_count"])

#catalog university majors, requirements, and courses
for requirement in articulations["requirements"]:
    group_id = get_major_requirement_group_id(cursor, major_id, requirement["category"], requirement["group"])
    insert_major_requirement(cursor, major_id, requirement["text"], requirement["category"], requirement["articulation_status"], requirement["note"], group_id)
    major_requirement_id = get_major_requirement_id(cursor, major_id, requirement["text"], requirement["category"])
    for option in requirement["options"]:
        insert_major_requirement_option(cursor, major_requirement_id, option["option_number"])
        major_requirement_option_id = get_major_requirement_option_id(cursor, major_requirement_id, option["option_number"])
        for course_code in option["courses"]:
            course_id = get_course_id(cursor, 1, course_code)
            if course_id:
                insert_major_requirement_option_course(cursor, major_requirement_option_id, course_id)

        
results = get_major_requirements(cursor, "University of California, Berkeley", "Computer Science, B.A.")
for row in results:
    print(row)
#get the different course requirements for the major at the university

connection.commit()
#commits changes
