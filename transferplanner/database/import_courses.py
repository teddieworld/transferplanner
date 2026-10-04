import psycopg
import json
from pprint import pprint

#parse functions SQL
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
#SQL to python

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
#Organize SQL data about major requirements into nested structure
def build_major_plan(rows):
    plan = {
        "university" : rows[0][0],
        "major" : rows[0][1],
        "categories" : {}
    }
    for row in rows:
        category = row[6]
        if category not in plan["categories"]:
            plan["categories"][category] = {}

        group_name = row[2]
        required_count = row[3]
        if group_name not in plan["categories"][category]:
            plan["categories"][category][group_name] = {
                "required_count": required_count,
                "requirements": {}
            }

        requirement_text = row[4]
        articulation_status = row[7]
        note = row[8]
        group = plan["categories"][category][group_name]
        if requirement_text not in group["requirements"]:
            group["requirements"][requirement_text] = {
                "articulation_status": articulation_status,
                "note": note,
                "options": {}
            }

        option_number = row[5]
        requirement = group["requirements"][requirement_text]
        if option_number is not None:
            if option_number not in requirement["options"]:
                requirement["options"][option_number] = {
                    "courses": []
                }

        course_code = row[9]
        course_title = row[10]
        if course_code is not None and option_number is not None:
            option = requirement["options"][option_number]
            option["courses"].append({
                "code": course_code,
                "title": course_title
            })

    return plan

#checkeach course in an option and if the user has it, then it satisfies
def is_option_satisfied(option, completed_courses):
    for course in option["courses"]:
        code = course["code"]
        if code not in completed_courses:
            return False
    return True
#checks each option in a requirement, if the user has it, then it will satisfy
def is_requirement_satisfied(requirement, completed_courses):
    for option in requirement["options"].values():
        if is_option_satisfied(option, completed_courses):
            return "satisfied"
    return False
#check each requirement within a group
def is_group_satisfied(group, completed_courses):
    satisfied_count = 0
    required_count = group["required_count"]
    for requirement in group["requirements"].values():
        status = get_requirement_status(requirement, completed_courses)
        if status == "satisfied":
            satisfied_count += 1
        elif status == "partial":
            print("partial credit")
    if required_count is None:
        if satisfied_count == len(group["requirements"]):
            return True
    elif required_count <= satisfied_count:
        return True
  
    return False
#check each group within a category and return if its satisfied
def is_category_satisfied(category, completed_courses):
    for group in category.values():
        if is_group_satisfied(group, completed_courses) is False:
            return False
    return True
#check the articulation status for a requirement
def get_requirement_status(requirement, completed_courses):
    articulation_status = requirement["articulation_status"]
    if articulation_status == "articulated":
        if is_requirement_satisfied(requirement, completed_courses):
            return "satisfied"
        else:
            return "not_satisfied" 
    elif articulation_status == "partial":
        if is_requirement_satisfied(requirement, completed_courses):
            return "partial"
        else:
            return "not_satisfied" 
    elif articulation_status == "no_course_articulated":
        return "no_course_articulated"
    elif articulation_status == "university_only":
        return "university_only"
    
    return "error"

#check if a catgegory 'A' 'B' in a category is satisfied
def get_category_status(category, completed_courses):
    group_statuses = {}
    for group_name, group in category.items():
        group_statuses[group_name] = get_group_status(group, completed_courses)
    category_satisfied = is_category_satisfied(category, completed_courses)
    return {
        "satisfied":category_satisfied,
        "groups": group_statuses
    }
#check the categories within a major and if they are satsified
def get_major_status(plan, completed_courses):
    categories = {}
    for category_name, category in plan["categories"].items():
        categories[category_name] = get_category_status(category, completed_courses)

    major_satisfied = categories["required"]["satisfied"]

    return {
        "satisfied" : major_satisfied,
        "categories" : categories
    }

#return a dictionary of whether each requirement within a group is satisfied and the courses within it
def get_group_status(group, completed_courses):
    requirement_statuses = {}
    for requirement_name, requirement in group["requirements"].items():
        requirement_statuses[requirement_name] = get_requirement_status(requirement, completed_courses)
    group_satisfied = is_group_satisfied(group, completed_courses)
    return {
        "satisfied" : group_satisfied,
        "requirements" : requirement_statuses
    }

"""hierarchy of course organization:
categories: "required", "highly_recommended"
    groups: "A", "B" within each category
        requirements: "MATH 54" or "CS 5"
            options: "Option 1" or "Option 2"
                courses: "MATH 180" or [....]
"""


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
#get the different course requirements for the major at the university

plan = build_major_plan(results)

completed_courses1 = ["MATH 180", "MATH 181", "MATH 280", "MATH 285"]
major_status1 = get_major_status(plan, completed_courses1)

completed_courses2 = ["MATH 180", "MATH 280", "MATH 285"]
major_status2 = get_major_status(plan, completed_courses2)
pprint(major_status1)
pprint(major_status2)


connection.commit()
#commits changes
