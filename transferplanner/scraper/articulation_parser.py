"""Convert an exported ASSIST response into the project's agreement JSON.

This converter supports the course/group structures in the Berkeley CS,
Mathematics, and Aerospace samples. Unrecognized rules raise errors instead of being simplified.
General instructions are preserved for review; this script never writes to SQL.
"""
import argparse
import json
import html
import re
from pathlib import Path

REVIEWED_RULES_PATH = Path(__file__).resolve().parents[1] / "data/reviewed_preparation_rules.json"
GROUP_RULES_PATH = Path(__file__).resolve().parents[1] / "data/reviewed_group_rules.json"
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
    course = course.get("course", course)
    return f"{course['prefix'].strip()} {course['courseNumber'].strip()}"


def plain_text(content):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", content)).split())


HEADINGS = {
    "REQUIRED FOR ADMISSION": "required",
    "REQUIRED COURSES FOR ADMISSION": "required",
    "HIGHLY RECOMMENDED": "highly_recommended",
    "STRONGLY RECOMMENDED COURSES": "highly_recommended",
    "LOWER DIVISION MAJOR REQUIREMENTS": "major_required"
}
SECTION_NOTES = {"A substitute course may be available for this major only", "Consult an adviser"}


def get_receiving_label(cell):
    if cell["type"] == "Course":
        return get_course_code(cell["course"])
    if cell["type"] == "Requirement":
        name = cell["requirement"].get("name")
        if not isinstance(name, str) or not name.strip():
            raise ValueError("Named requirement must have a nonempty name")
        return name.strip()
    if cell["type"] == "Series":
        series = cell["series"]
        if series.get("conjunction") != "And" or not series.get("courses"):
            raise ValueError("Receiving series must contain courses joined by AND")
        codes = [get_course_code(course) for course in sorted_by_position(series["courses"])]
        if len(set(codes)) != len(codes):
            raise ValueError("Receiving series contains duplicate courses")
        # The whole series is one choice in its requirement group.
        return " AND ".join(codes)
    raise ValueError(f"Unsupported receiving cell type: {cell['type']}")


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
        if option["type"] != "CourseGroup" or option["courseConjunction"] not in ("And", "Or"):
            raise ValueError("Course groups must use an AND or OR conjunction")
        courses = sorted_by_position(option["items"])
        if not courses or any(course["type"] != "Course" for course in courses):
            raise ValueError("Option must contain ordinary course items")
        codes = [get_course_code(course) for course in courses]
        alternatives = [codes] if option["courseConjunction"] == "And" else [[code] for code in codes]
        for alternative in alternatives:
            options.append({"option_number": len(options) + 1, "courses": alternative})
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


def get_requirement_sections(group):
    """Return (rows, required_count) pairs supported by our flat group model."""
    items = sorted_by_position(group["sections"])
    if (group.get("advisements") or group.get("attributes") or any(
            item.get("attributes") and (item["type"] != "Section" or any(
                attribute["content"] not in SECTION_NOTES for attribute in item["attributes"]))
            for item in items)):
        raise ValueError("Empty sections or group/section instructions need review")
    sections = []
    for item in items:
        if item["type"] == "SectionHeader":
            if item.get("rows") or item.get("advisements"):
                raise ValueError("Section headers with completion rules need review")
            continue
        if item["type"] != "Section":
            raise ValueError(f"Unsupported section type: {item['type']}")
        sections.append(item)
    if not sections:
        raise ValueError("No requirement sections were found")
    instruction = group.get("instruction")
    if instruction is None:
        if len(sections) != 1 or group.get("showConjunctionBetweenSections"):
            raise ValueError("Multiple sections need an explicit relationship")
    else:
        if instruction.get("selectionType") != "Complete":
            raise ValueError("Unsupported section selection rule")
        instruction_type = instruction.get("type")
        if instruction_type == "Conjunction":
            conjunction = instruction.get("conjunction")
            if conjunction == "Or":
                # OR between single-course sections is equivalent to completing
                # one requirement. OR between compound sections needs nesting.
                if any(len(section["rows"]) != 1 or section.get("advisements")
                       for section in sections):
                    raise ValueError("OR between compound sections needs a nested model")
                return [([section["rows"][0] for section in sections], 1)]
            if conjunction != "And":
                raise ValueError("Unsupported relationship between sections")
        elif instruction_type == "Following":
            if group.get("showConjunctionBetweenSections"):
                raise ValueError("Following sections have an unexpected conjunction")
        else:
            raise ValueError("Unsupported relationship between sections")
    return [(sorted_by_position(section["rows"]), get_required_count(section))
            for section in sections]


def apply_reviewed_preparation_rules(agreement, rules):
    for rule in rules:
        if any(agreement[key] != rule[key] for key in ("university", "major", "college", "academic_year")):
            continue
        if agreement["source"]["publish_date"] != rule["source_publish_date"]:
            raise ValueError("Reviewed preparation rule needs checking against the new publication")
        instructions = [
            " ".join(html.unescape(re.sub(r"<[^>]+>", " ",asset["content"])).split())
            for asset in agreement["source"]["general_information"]
            if asset["type"] == "GeneralText"
        ]
        if not any(rule["source_instruction"] in text for text in instructions):
            raise ValueError("Reviewed preparation instruction is absent from the source")
        matches = [requirement for requirement in agreement["requirements"]
                   if requirement["text"] == rule["requirement_text"] and requirement["category"] == rule["category"]]
        if len(matches) != 1:
            raise ValueError("Reviewed preparation rule does not identify one requirement")
        requirement = matches[0]
        if [option["courses"] for option in requirement["options"]] != rule["expected_equivalence_options"]:
            raise ValueError("Course equivalence changed; review the preparation exception again")
        preparation_options = rule["preparation_options"]
        if not preparation_options or any(
            not option or any(not isinstance(code, str) or not code.strip() for code in option)
            for option in preparation_options
        ):
            raise ValueError("Reviewed preparation options must contain course codes")
        requirement["preparation_options"] = preparation_options
        requirement["preparation_note"] = rule["source_instruction"]


def apply_reviewed_group_rules(agreement):
    with GROUP_RULES_PATH.open(encoding="utf-8") as file:
        rules = json.load(file)
    text = " ".join(plain_text(a["content"]) for a in agreement["source"]["general_information"]
                    if a["type"] == "GeneralText")
    for rule in rules:
        if any(agreement[key] != rule[key] for key in ("major", "university", "college", "academic_year")):
            continue
        if agreement["source"]["publish_date"] != rule["source_publish_date"] or rule["source_instruction"] not in text:
            raise ValueError("Reviewed group rule needs checking against the source publication")
        matches = [g for g in agreement["groups"] if g["category"] == rule["category"] and g["name"] == rule["group"]]
        if len(matches) != 1:
            raise ValueError("Reviewed group rule does not identify one group")
        group = matches[0]
        members = [r for r in agreement["requirements"] if r["category"] == rule["category"] and r["group"] == rule["group"]]
        if sorted(r["text"] for r in members) != sorted(rule["expected_requirements"]):
            raise ValueError("Reviewed group's courses have changed")
        if "max_per_department" in rule:
            if group["required_count"] != 3 or any(not r.get("department") for r in members):
                raise ValueError("Department limit needs a three-course group with department metadata")
            group["max_per_department"] = rule["max_per_department"]
        if rule.get("review_required"):
            group["review_required"] = True
        group["note"] = "\n".join(filter(None, [group.get("note"), rule["note"]]))


def build_agreement(agreement, reviewed_rules=None):
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
    section_numbers = {"required": 0, "highly_recommended": 0, "major_required": 0}
    used_cells = set()
    receiving_course_attributes = []
    receiving_cross_listed_courses = []
    section_headers = []
    for asset in sorted_by_position(assets):
        if asset["area"] != "Requirements":
            continue
        if asset["type"] == "RequirementTitle":
            title = asset["content"].strip().upper()
            if title not in HEADINGS:
                raise ValueError(f"Unrecognized requirement heading: {title}")
            category = HEADINGS[title]
            continue
        if asset["type"] != "RequirementGroup" or category is None:
            raise ValueError("Unsupported requirement asset or missing heading")
        row_context = {}
        section_category = category
        for section in sorted_by_position(asset["sections"]):
            if section["type"] == "SectionHeader":
                section_category = HEADINGS.get(section["content"].strip().upper(), section_category)
                section_headers.append({
                    "category": section_category, "requirement_group_position": asset["position"],
                    "header": section
                })
            else:
                for row in section.get("rows", []):
                    row_context[id(row)] = (section_category, section)
        for rows, required_count in get_requirement_sections(asset):
            categories = {row_context[id(row)][0] for row in rows}
            if len(categories) != 1:
                raise ValueError("A group must have one requirement category")
            group_category = categories.pop()
            number = section_numbers[group_category]
            if number >= 26:
                raise ValueError("More than 26 sections need a different group naming scheme")
            group_name = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[number]
            section_numbers[group_category] += 1
            group = {"name": group_name, "category": group_category, "required_count": required_count}
            section_notes = list(dict.fromkeys(attribute["content"] for row in rows
                for attribute in row_context[id(row)][1].get("attributes", [])))
            if section_notes:
                group["note"] = "\n".join(section_notes)
            result["groups"].append(group)
            requirement_count = 0
            for row in rows:
                if len(row["cells"]) != 1 or row.get("attributes"):
                    raise ValueError("Multi-cell rows or row instructions need review")
                cell = row["cells"][0]
                label = get_receiving_label(cell)
                if cell.get("requisites"):
                    raise ValueError("Unsupported receiving course structure")
                if cell["id"] in used_cells:
                    raise ValueError("Duplicate template cell")
                used_cells.add(cell["id"])
                if any(cell.get(key) for key in ("attributes", "courseAttributes", "seriesAttributes", "requirementAttributes")):
                    attributes = {
                        "template_cell_id": cell["id"],
                        "course": label,
                        "attributes": cell.get("attributes", []),
                        "course_attributes": cell.get("courseAttributes", [])
                    }
                    for source_key, key in [("seriesAttributes", "series_attributes"),
                                            ("requirementAttributes", "requirement_attributes")]:
                        if cell.get(source_key):
                            attributes[key] = cell[source_key]
                    receiving_course_attributes.append(attributes)
                articulation = by_cell.get(cell["id"])
                aliases = []
                for owner in [cell, articulation or {}]:
                    for course in owner.get("visibleCrossListedCourses", []):
                        code = get_course_code(course)
                        if code not in aliases:
                            aliases.append(code)
                if aliases:
                    receiving_cross_listed_courses.append({
                        "template_cell_id": cell["id"], "requirement": label, "aliases": aliases
                    })
                options = build_options(articulation)
                notes = get_articulation_notes(articulation)
                requirement = {
                    "text": label,
                    "group": group_name,
                    "category": group_category,
                    "articulation_status": get_articulation_status(articulation),
                    "note": "\n".join(notes) if notes else None,
                    "options": options
                }
                if group_category == "major_required" and cell["type"] == "Course":
                    requirement["department"] = cell["course"].get("department")
                result["requirements"].append(requirement)
                requirement_count += 1
            if requirement_count == 0 or (group["required_count"] is not None and group["required_count"] > requirement_count):
                raise ValueError("Group has too few requirements")
    if set(by_cell) - used_cells:
        raise ValueError("Articulation entries refer to unknown template cells")
    if not result["groups"]:
        if by_cell or any(a["area"] == "Requirements" for a in assets) or not any(a["area"] == "General" for a in assets):
            raise ValueError("No course groups or informational guidance were found")
        result["kind"] = "informational"

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
    if receiving_course_attributes:
        result["source"]["receiving_course_attributes"] = receiving_course_attributes
    if section_headers:
        result["source"]["section_headers"] = section_headers
    if receiving_cross_listed_courses:
        result["source"]["receiving_cross_listed_courses"] = receiving_cross_listed_courses
    result["review_required"] = bool(general_information or receiving_course_attributes or section_headers or receiving_cross_listed_courses)
    result["review_notes"] = [
        "Review preserved general instructions before importing. They may contain major-specific exceptions or exam-credit rules."
    ] if general_information else []
    if receiving_course_attributes:
        result["review_notes"].append(
            "Review preserved receiving-course attributes; they are not interpreted as completion rules."
        )
    if section_headers:
        result["review_notes"].append(
            "Review preserved section headers; they are labels, not interpreted completion rules."
        )
    if receiving_cross_listed_courses:
        result["review_notes"].append(
            "Receiving cross-listed courses are preserved as aliases, not additional requirements."
        )
    apply_reviewed_preparation_rules(result, reviewed_rules or [])
    apply_reviewed_group_rules(result)
    return result


def convert_file(input_path, output_path, reviewed_rules=None):
    if Path(input_path).resolve() == Path(output_path).resolve():
        raise ValueError("Input and output must be different files")
    if reviewed_rules is None:
        with open(REVIEWED_RULES_PATH, encoding="utf-8") as file:
            reviewed_rules = json.load(file)
    agreement = build_agreement(load_assist_response(input_path), reviewed_rules)
    with open(output_path, "w", encoding="utf-8") as file:
        json.dump(agreement, file, indent=2, ensure_ascii=False)
        file.write("\n")
    return agreement


def convert_folder(input_folder, output_folder):
    input_folder, output_folder = Path(input_folder), Path(output_folder)
    if not input_folder.is_dir():
        raise ValueError(f"Input folder does not exist: {input_folder}")
    if input_folder.resolve() == output_folder.resolve():
        raise ValueError("Input and output folders must be different")
    inputs = sorted(path for path in input_folder.glob("*.json") if path.is_file())
    if not inputs:
        raise ValueError(f"No JSON files found in: {input_folder}")
    with open(REVIEWED_RULES_PATH, encoding="utf-8") as file:
        reviewed_rules = json.load(file)
    output_folder.mkdir(parents=True, exist_ok=True)
    report = {"converted": 0, "failed": 0, "review_required": 0, "files": []}
    for input_path in inputs:
        output_path = output_folder / f"{input_path.stem}_generated.json"
        try:
            agreement = convert_file(input_path, output_path, reviewed_rules)
        except Exception as error:
            # Each file is independent. Record the error type as well as its
            # message so unexpected parser failures remain visible for review.
            report["failed"] += 1
            report["files"].append({
                "input": str(input_path), "status": "failed", "output": None,
                "error_type": type(error).__name__, "error": str(error)
            })
        else:
            report["converted"] += 1
            report["review_required"] += int(agreement["review_required"])
            report["files"].append({
                "input": str(input_path), "status": "converted", "output": str(output_path),
                "groups": len(agreement["groups"]), "requirements": len(agreement["requirements"]),
                "review_required": agreement["review_required"], "review_notes": agreement["review_notes"]
            })
    report_path = output_folder / "batch_report.json"
    with report_path.open("w", encoding="utf-8") as file:
        json.dump(report, file, indent=2, ensure_ascii=False)
        file.write("\n")
    print(f"Converted: {report['converted']}; failed: {report['failed']}; "
          f"converted agreements needing review: {report['review_required']}. Report: {report_path}")
    return report


def main(input_path, output_path):
    agreement = convert_file(input_path, output_path)
    print(f"Wrote {len(agreement['groups'])} groups and {len(agreement['requirements'])} requirements to {output_path}")
    if agreement["review_required"]:
        print("Review required: general instructions and receiving-course notes are preserved in source.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert supported ASSIST responses into agreement JSON.")
    parser.add_argument("input", type=Path, help="Raw ASSIST response file, or input folder with --batch")
    parser.add_argument("output", type=Path, help="Output JSON file, or output folder with --batch")
    parser.add_argument("--batch", action="store_true", help="Convert all JSON files directly inside the input folder")
    args = parser.parse_args()
    try:
        if args.batch:
            report = convert_folder(args.input, args.output)
            raise SystemExit(1 if report["failed"] else 0)
        main(args.input, args.output)
    except (OSError, ValueError) as error:
        parser.error(str(error))
