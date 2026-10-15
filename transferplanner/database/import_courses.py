import argparse
import json
import html
import re

#parse functions SQL
def connect_to_database():
    import psycopg
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
def insert_major_requirement(cursor, major_id, requirement_text,requirement_category, articulation_status, note, group_id, preparation_note=None, department=None):
    query = """
        INSERT into major_requirements(
            major_id,
            requirement_text,
            requirement_category,
            articulation_status,
            note,
            group_id,
            preparation_note,
            department
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
        ON CONFLICT(group_id, requirement_text)
        DO UPDATE SET preparation_note = COALESCE(EXCLUDED.preparation_note, major_requirements.preparation_note),
            department = COALESCE(EXCLUDED.department, major_requirements.department)
    """
    values = (
        major_id,
        requirement_text,
        requirement_category,
        articulation_status,
        note,
        group_id,
        preparation_note,
        department
    )
    cursor.execute(query,values)
def get_major_requirement_id(cursor, group_id, requirement_text):
    query = """
        SELECT id
        FROM major_requirements
        WHERE group_id = %s
        AND requirement_text = %s;
    """
    values = (
        group_id,
        requirement_text
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
def insert_major_requirement_option(cursor, major_requirement_id, option_number, option_kind="equivalence"):
    query = """
        INSERT into major_requirement_options(
            major_requirement_id,
            option_number,
            option_kind
        )
        VALUES(
            %s,
            %s,
            %s
        )
        ON CONFLICT(major_requirement_id, option_kind, option_number)
        DO NOTHING
    """
    values = (
        major_requirement_id,
        option_number,
        option_kind
    )
    cursor.execute(query,values)
def get_major_requirement_option_id(cursor, major_requirement_id, option_number, option_kind="equivalence"):
    query = """
        SELECT id
        FROM major_requirement_options
        WHERE major_requirement_id = %s
        AND option_number = %s
        AND option_kind = %s;
    """
    values = (
        major_requirement_id,
        option_number,
        option_kind
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
def insert_articulation_agreement(cursor, major_id, college_id, academic_year, metadata=None):
    cursor.execute("""
        INSERT INTO articulation_agreements (major_id, college_id, academic_year, planner_metadata)
        VALUES (%s, %s, %s, %s::jsonb)
        ON CONFLICT (major_id, college_id, academic_year)
        DO UPDATE SET planner_metadata = articulation_agreements.planner_metadata || EXCLUDED.planner_metadata
        RETURNING id
    """, (major_id, college_id, academic_year, json.dumps(metadata or {})))
    return cursor.fetchone()[0]

def insert_major_requirement_group(cursor, major_id, agreement_id, group_name, requirement_category, required_count, rules=None):
    query = """
        INSERT into major_requirement_groups(
            major_id,
            agreement_id,
            group_name,
            requirement_category,
            required_count,
            rules
        )
        VALUES(
            %s,
            %s,
            %s,
            %s,
            %s,
            %s::jsonb
        )
        ON CONFLICT(agreement_id, requirement_category, group_name)
        DO UPDATE SET rules = major_requirement_groups.rules || EXCLUDED.rules
    """
    values = (
        major_id,
        agreement_id,
        group_name,
        requirement_category,
        required_count,
        json.dumps(rules or {})
    )
    cursor.execute(query, values)
def get_major_requirement_group_id(cursor, agreement_id, requirement_category, group_name):
    query = """
        SELECT id
        FROM major_requirement_groups
        WHERE agreement_id = %s
        AND requirement_category = %s
        AND group_name = %s
    """
    values = (
        agreement_id,
        requirement_category,
        group_name
    )
    cursor.execute(query, values)
    result = cursor.fetchone()
    if result:
        return result[0]
    return None
#SQL to python

def get_major_requirements(cursor, university_name, major_name, academic_year, college_name):
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
        c.title,
        mro.option_kind,
        mr.preparation_note,
        mrg.rules,
        mr.department
        FROM universities u

        JOIN majors m
            ON m.university_id = u.id

        JOIN major_requirements mr
            ON mr.major_id = m.id

        LEFT JOIN major_requirement_options mro
            ON mro.major_requirement_id = mr.id

        LEFT JOIN major_requirement_groups mrg
            ON mr.group_id = mrg.id

        JOIN articulation_agreements agreement
            ON agreement.id = mrg.agreement_id

        JOIN colleges college
            ON college.id = agreement.college_id

        LEFT JOIN major_requirement_option_courses mroc
            ON mroc.option_id = mro.id

        LEFT JOIN courses c
            ON mroc.course_id = c.id

        WHERE u.name = %s
        AND m.name = %s
        AND agreement.academic_year = %s
        AND college.name = %s
        ORDER BY mr.requirement_category, mrg.group_name, mr.id, mro.option_kind, mro.option_number, c.code;
    """
    #Selects the values that are joined together from the different datatables with corresponding foreign keys
    #gets the matching id for the parameter u.name and m.name and goes down the chain of foreign keys to find all corresponding data
    
    values = (
        university_name,
        major_name,
        academic_year,
        college_name
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
                "requirements": {},
                **(row[13] if len(row) > 13 else {})
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
            if len(row) > 14 and row[14]:
                group["requirements"][requirement_text]["department"] = row[14]
            if row[12]:
                group["requirements"][requirement_text]["preparation_note"] = row[12]

        option_number = row[5]
        requirement = group["requirements"][requirement_text]
        option_key = "preparation_options" if row[11] == "preparation" else "options"
        if option_number is not None:
            requirement.setdefault(option_key, {})
            if option_number not in requirement[option_key]:
                requirement[option_key][option_number] = {
                    "courses": []
                }

        course_code = row[9]
        course_title = row[10]
        if course_code is not None and option_number is not None:
            option = requirement[option_key][option_number]
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
    if not group["requirements"] or group.get("review_required"):
        return False
    satisfied = [r for r in group["requirements"].values()
                 if get_preparation_status(r, completed_courses) == "satisfied"]
    limit = group.get("max_per_department")
    if limit is not None:
        departments = {}
        for requirement in satisfied:
            department = requirement.get("department")
            if not department:
                return False
            departments[department] = departments.get(department, 0) + 1
        satisfied_count = sum(min(count, limit) for count in departments.values())
    else:
        satisfied_count = len(satisfied)
    required_count = group["required_count"]
    return satisfied_count >= (len(group["requirements"]) if required_count is None else required_count)
#check each group within a category and return if its satisfied
def is_category_satisfied(category, completed_courses):
    if not category:
        return False
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

def get_preparation_status(requirement, completed_courses):
    if "preparation_options" not in requirement:
        return get_requirement_status(requirement, completed_courses)
    for option in requirement["preparation_options"].values():
        if is_option_satisfied(option, completed_courses):
            return "satisfied"
    return "not_satisfied"

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

    major_satisfied = categories.get("required", {}).get("satisfied", False)

    return {
        "satisfied" : major_satisfied,
        "categories" : categories
    }

#return a dictionary of whether each requirement within a group is satisfied and the courses within it
def get_group_status(group, completed_courses):
    requirement_statuses = {}
    preparation_statuses = {}
    for requirement_name, requirement in group["requirements"].items():
        requirement_statuses[requirement_name] = get_requirement_status(requirement, completed_courses)
        preparation_statuses[requirement_name] = get_preparation_status(requirement, completed_courses)
    group_satisfied = is_group_satisfied(group, completed_courses)
    return {
        "satisfied" : group_satisfied,
        "requirements" : requirement_statuses,
        "preparation_requirements": preparation_statuses
    }

"""hierarchy of course organization:
categories: "required", "highly_recommended"
    groups: "A", "B" within each category
        requirements: "MATH 54" or "CS 5"
            options: "Option 1" or "Option 2"
                courses: "MATH 180" or [....]
"""



def import_course_catalog(cursor, courses, college_id):
    """Import the catalog only when the caller explicitly supplies it."""
    for course in courses:
        insert_course(cursor, course, college_id)
        course_id = get_course_id(cursor, college_id, course["code"])
        for requirement in course["requirements"]:
            requirement_id = insert_requirement(cursor, course_id, requirement)
            for course_code in requirement["courses"]:
                referenced_id = get_course_id(cursor, college_id, course_code)
                if referenced_id is not None:
                    insert_requirement_course(cursor, requirement_id, referenced_id)


def get_college_id(cursor, college_name):
    cursor.execute("SELECT id FROM colleges WHERE name = %s", (college_name,))
    result = cursor.fetchone()
    if result is None:
        raise ValueError(f"College is missing from database: {college_name}")
    return result[0]


def import_agreement(cursor, agreement):
    """Import one normalized agreement using the existing catalog; do not commit."""
    college_id = get_college_id(cursor, agreement["college"])
    university_id = get_university_id(cursor, agreement["university"])
    if university_id is None:
        raise ValueError(f"University is missing from database: {agreement['university']}")

    # Check every referenced course before writing any agreement rows. A missing
    # course must not turn an AND series into a shorter, easier requirement.
    course_codes = set()
    groups = {(group["category"], group["name"]) for group in agreement["groups"]}
    for requirement in agreement["requirements"]:
        if (requirement["category"], requirement["group"]) not in groups:
            raise ValueError(f"Requirement has an unknown group: {requirement['text']}")
        options = [option["courses"] for option in requirement["options"]]
        options += requirement.get("preparation_options", [])
        for courses in options:
            if not courses or any(not isinstance(code, str) or not code.strip() for code in courses):
                raise ValueError(f"Option must contain course codes: {requirement['text']}")
            course_codes.update(courses)
    course_ids = {code: get_course_id(cursor, college_id, code) for code in sorted(course_codes)}
    missing = [code for code, course_id in course_ids.items() if course_id is None]
    if missing:
        raise ValueError(f"Agreement courses are missing from catalog: {', '.join(missing)}")

    kind = agreement.get("kind", "structured")
    if kind not in ("structured", "informational"):
        raise ValueError("Unknown agreement kind")
    if kind == "informational" and (agreement["groups"] or agreement["requirements"]):
        raise ValueError("Informational agreements cannot contain evaluable course groups")
    if kind == "structured" and not agreement["groups"]:
        raise ValueError("Structured agreement has no course groups")
    metadata = {}
    if agreement.get("source") or kind == "informational":
        metadata = {
            "kind": kind,
            "notes": [" ".join(html.unescape(re.sub(r"<[^>]+>", " ", a["content"])).split())
                      for a in agreement.get("source", {}).get("general_information", [])],
            "reviewNotes": agreement.get("review_notes", [])
        }
    insert_major(cursor, university_id, agreement["major"])
    major_id = get_major_id(cursor, university_id, agreement["major"])
    agreement_id = insert_articulation_agreement(cursor, major_id, college_id, agreement["academic_year"], metadata)
    for group in agreement["groups"]:
        insert_major_requirement_group(
            cursor, major_id, agreement_id, group["name"], group["category"], group["required_count"],
            {key: group[key] for key in ("note", "max_per_department", "review_required") if key in group}
        )

    for requirement in agreement["requirements"]:
        group_id = get_major_requirement_group_id(
            cursor, agreement_id, requirement["category"], requirement["group"]
        )
        insert_major_requirement(
            cursor, major_id, requirement["text"], requirement["category"],
            requirement["articulation_status"], requirement["note"], group_id,
            requirement.get("preparation_note"), requirement.get("department")
        )
        requirement_id = get_major_requirement_id(cursor, group_id, requirement["text"])
        options = [("equivalence", option["option_number"], option["courses"])
                   for option in requirement["options"]]
        options += [("preparation", number, courses)
                    for number, courses in enumerate(requirement.get("preparation_options", []), start=1)]
        for kind, number, courses in options:
            insert_major_requirement_option(cursor, requirement_id, number, kind)
            option_id = get_major_requirement_option_id(cursor, requirement_id, number, kind)
            for code in courses:
                insert_major_requirement_option_course(cursor, option_id, course_ids[code])
    return agreement_id


def main(agreement_path, courses_path=None):
    agreement = load_articulations_json(agreement_path)
    courses = load_courses_json(courses_path) if courses_path is not None else None
    # This context commits once on success and rolls back on any exception.
    with connect_to_database() as connection:
        with connection.cursor() as cursor:
            if courses is not None:
                college_id = get_college_id(cursor, agreement["college"])
                import_course_catalog(cursor, courses, college_id)
            agreement_id = import_agreement(cursor, agreement)
    print(f"Imported {agreement['major']} ({agreement['academic_year']}), agreement {agreement_id}: "
          f"{len(agreement['groups'])} groups, {len(agreement['requirements'])} requirements.")
    if agreement.get("review_required"):
        print("Source notes remain preserved in JSON; general education and exam credit are not evaluated.")
    return agreement_id


def import_agreements(agreement_paths, courses_path=None):
    """Import reviewed files independently so one failure does not stop the batch."""
    report = {"imported": 0, "failed": 0, "files": []}
    for agreement_path in agreement_paths:
        try:
            # main() owns the connection and transaction for this file only.
            agreement_id = main(agreement_path, courses_path)
        except Exception as error:
            report["failed"] += 1
            report["files"].append({
                "input": str(agreement_path), "status": "failed",
                "error_type": type(error).__name__, "error": str(error)
            })
            print(f"Failed {agreement_path}: {type(error).__name__}: {error}")
        else:
            report["imported"] += 1
            report["files"].append({
                "input": str(agreement_path), "status": "imported", "agreement_id": agreement_id
            })
    print(f"Import summary: {report['imported']} succeeded; {report['failed']} failed.")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import one or more reviewed, normalized articulation agreements.")
    parser.add_argument("agreement", nargs="+", help="Paths to reviewed, normalized agreement JSON files")
    parser.add_argument("--courses", help="Optional catalog JSON to import before the agreement")
    args = parser.parse_args()
    report = import_agreements(args.agreement, args.courses)
    raise SystemExit(1 if report["failed"] else 0)
