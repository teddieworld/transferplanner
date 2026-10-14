"""Convert an exported ASSIST response into the project's agreement JSON.

This first converter supports the course/group structure in the Berkeley CS
sample. Unrecognized rules raise errors instead of being silently simplified.
General instructions are preserved for review; this script never writes to SQL.
"""
import json

RAW_PATH = "transferplanner/data/raw/berkeley_cs_2026_2027.json"
OUTPUT_PATH = "transferplanner/data/berkeley_cs_2026_2027_generated.json"
PARTIAL_NOTE = (
    "Must complete an additional university course "
    "after transfer to satisfy this requirement"
)
UNIVERSITY_ONLY_NOTE = "This course must be taken at the university after transfer"


def load_assist_response(filepath):
    with open(filepath, encoding="utf-8") as file:
        response = json.load(file)
    if response.get("isSuccessful") is not True or not response.get("result"):
        raise ValueError("ASSIST response was not successful")
    return response["result"]


def sorted_by_position(items):
    return sorted(items, key=lambda item: item["position"])


def get_course_code(course):
    return f"{course['prefix'].strip()} {course['courseNumber'].strip()}"


def get_articulation_notes(articulation):
    if articulation is None:
        return []
    sending = articulation["sendingArticulation"]
    notes = []
    if sending.get("noArticulationReason"):
        notes.append(sending["noArticulationReason"])
    # Preserve notes attached to the articulation, group, and individual courses.
    for owner in [articulation, sending]:
        for attribute in sorted_by_position(owner.get("attributes", [])):
            notes.append(attribute["content"])
    for option in sorted_by_position(sending["items"]):
        for owner in [option] + sorted_by_position(option["items"]):
            for attribute in sorted_by_position(owner.get("attributes", [])):
                notes.append(attribute["content"])
    unique_notes = []
    for note in notes:
        if note not in unique_notes:
            unique_notes.append(note)
    return unique_notes


def get_articulation_status(articulation):
    if articulation is None:
        return "no_course_articulated"
    sending = articulation["sendingArticulation"]
    reason = sending.get("noArticulationReason")
    if reason == UNIVERSITY_ONLY_NOTE:
        return "university_only"
    if reason:
        raise ValueError(f"Unrecognized articulation reason: {reason}")
    if PARTIAL_NOTE in get_articulation_notes(articulation):
        return "partial"
    return "articulated" if sending["items"] else "no_course_articulated"


def build_options(articulation):
    if articulation is None:
        return []
    if articulation.get("templateOverrides"):
        raise ValueError("Template overrides need review before conversion")
    sending = articulation["sendingArticulation"]
    groups = sorted_by_position(sending["items"])
    conjunctions = sending.get("courseGroupConjunctions", [])
    expected_links = [
        (groups[index - 1]["position"], groups[index]["position"])
        for index in range(1, len(groups))
    ]
    actual_links = []
    for conjunction in conjunctions:
        if conjunction["groupConjunction"] != "Or":
            raise ValueError("This converter supports OR between options only")
        actual_links.append((
            conjunction["sendingCourseGroupBeginPosition"],
            conjunction["sendingCourseGroupEndPosition"]
        ))
    if sorted(actual_links) != sorted(expected_links):
        raise ValueError("Option conjunctions are missing or unsupported")

    options = []
    for option in groups:
        if option["type"] != "CourseGroup" or option["courseConjunction"] != "And":
            raise ValueError("This converter supports AND course groups only")
        courses = sorted_by_position(option["items"])
        if not courses or any(course["type"] != "Course" for course in courses):
            raise ValueError("Option must contain ordinary course items")
        options.append({
            "option_number": len(options) + 1,
            "courses": [get_course_code(course) for course in courses]
        })
    return options


def get_required_count(section):
    advisements = section.get("advisements", [])
    if not advisements:
        return None
    if len(advisements) != 1:
        raise ValueError("Multiple section advisements need review")
    instruction = advisements[0]
    amount = instruction.get("amount")
    if (instruction["type"] != "NFollowing" or
            instruction["amountUnitType"] != "Course" or
            instruction["selectionType"] != "Complete" or
            not isinstance(amount, (int, float)) or amount < 1 or int(amount) != amount):
        raise ValueError("Section has an unsupported completion rule")
    return int(amount)


def build_agreement(agreement):
    assets = json.loads(agreement["templateAssets"])
    articulations = json.loads(agreement["articulations"])
    by_cell = {}
    for item in articulations:
        if item["templateCellId"] in by_cell:
            raise ValueError("Multiple mappings for one template cell need review")
        by_cell[item["templateCellId"]] = item["articulation"]

    receiving = json.loads(agreement["receivingInstitution"])
    sending = json.loads(agreement["sendingInstitution"])
    year = json.loads(agreement["academicYear"])
    college = sending["names"][0]["name"]
    # ASSIST and our catalog use different spellings for the same institution.
    if sending["id"] == 62:
        college = "Mt. San Antonio College"
    result = {
        "university": receiving["names"][0]["name"],
        "major": agreement["name"],
        "college": college,
        "academic_year": year["code"].replace("-", "–"),
        "groups": [],
        "requirements": []
    }
    category = None
    section_numbers = {"required": 0, "highly_recommended": 0}
    used_cells = set()
    for asset in sorted_by_position(assets):
        if asset["area"] != "Requirements":
            continue
        if asset["type"] == "RequirementTitle":
            title = asset["content"].strip().upper()
            headings = {"REQUIRED FOR ADMISSION": "required", "HIGHLY RECOMMENDED": "highly_recommended"}
            if title not in headings:
                raise ValueError(f"Unrecognized requirement heading: {title}")
            category = headings[title]
            continue
        if asset["type"] != "RequirementGroup" or category is None:
            raise ValueError("Unsupported requirement asset or missing heading")
        instruction = asset.get("instruction", {})
        if (instruction.get("type") != "Conjunction" or
                instruction.get("conjunction") != "And" or
                instruction.get("selectionType") != "Complete" or
                asset.get("showConjunctionBetweenSections") or asset.get("advisements")):
            raise ValueError("Unsupported relationship between sections")
        for section in sorted_by_position(asset["sections"]):
            number = section_numbers[category]
            if number >= 26:
                raise ValueError("More than 26 sections need a different group naming scheme")
            group_name = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[number]
            section_numbers[category] += 1
            group = {"name": group_name, "category": category, "required_count": get_required_count(section)}
            result["groups"].append(group)
            requirement_count = 0
            for row in sorted_by_position(section["rows"]):
                if len(row["cells"]) != 1 or row.get("attributes"):
                    raise ValueError("Multi-cell rows or row instructions need review")
                cell = row["cells"][0]
                if cell["type"] != "Course" or cell.get("requisites") or cell.get("visibleCrossListedCourses"):
                    raise ValueError("Unsupported receiving course structure")
                if cell["id"] in used_cells:
                    raise ValueError("Duplicate template cell")
                used_cells.add(cell["id"])
                articulation = by_cell.get(cell["id"])
                options = build_options(articulation)
                notes = get_articulation_notes(articulation)
                result["requirements"].append({
                    "text": get_course_code(cell["course"]),
                    "group": group_name,
                    "category": category,
                    "articulation_status": get_articulation_status(articulation),
                    "note": "\n".join(notes) if notes else None,
                    "options": options
                })
                requirement_count += 1
            if requirement_count == 0 or (group["required_count"] is not None and group["required_count"] > requirement_count):
                raise ValueError("Group has too few requirements")
    if set(by_cell) - used_cells:
        raise ValueError("Articulation entries refer to unknown template cells")
    if not any(group["category"] == "required" for group in result["groups"]):
        raise ValueError("No required groups were found")

    # These HTML strings include major exceptions and exam-credit instructions.
    # Keep them verbatim until those rules can be represented in the planner.
    general_information = [asset for asset in sorted_by_position(assets) if asset["area"] == "General"]
    result["source"] = {
        "system": "ASSIST",
        "publish_date": agreement["publishDate"],
        "sending_institution_id": sending["id"],
        "receiving_institution_id": receiving["id"],
        "academic_year_id": year["id"],
        "general_information": general_information
    }
    result["review_required"] = bool(general_information)
    result["review_notes"] = [
        "Review preserved general instructions before importing. They may contain major-specific exceptions or exam-credit rules."
    ] if general_information else []
    return result


def main():
    agreement = build_agreement(load_assist_response(RAW_PATH))
    with open(OUTPUT_PATH, "w", encoding="utf-8") as file:
        json.dump(agreement, file, indent=2, ensure_ascii=False)
        file.write("\n")
    print(f"Wrote {len(agreement['groups'])} groups and {len(agreement['requirements'])} requirements to {OUTPUT_PATH}")
    if agreement["review_required"]:
        print("Review required: general instructions are preserved in source.general_information.")


if __name__ == "__main__":
    main()
