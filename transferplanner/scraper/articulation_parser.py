"""Convert an exported ASSIST response into the project's agreement JSON.

The saved Berkeley dataset uses source-bound profiles for headings, sequence
alternatives, and groups that require adviser review. Unreviewed rules raise
errors instead of being simplified. This script never writes to SQL.
"""
import argparse
import json
import html
import hashlib
import re
import tempfile
from pathlib import Path
try:
    from .reviewed_templates import apply_template_rules
except ImportError:  # Direct script invocation.
    from reviewed_templates import apply_template_rules

REVIEWED_RULES_PATH = Path(__file__).resolve().parents[1] / "data/reviewed_preparation_rules.json"
GROUP_RULES_PATH = Path(__file__).resolve().parents[1] / "data/reviewed_group_rules.json"
HEADING_RULES_PATH = Path(__file__).resolve().parents[1] / "data/reviewed_heading_rules.json"
PROFILES_PATH = Path(__file__).resolve().parents[1] / "data/reviewed_agreement_profiles.json"
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
    "LOWER DIVISION MAJOR REQUIREMENTS": "major_required",
    "STRONGLY RECOMMENDED": "highly_recommended",
    "RECOMMENDED TO COMPLETE PRIOR TO TRANSFER": "highly_recommended"
}
GUIDANCE_NOTES = {
    "Please refer to additional important General Information section above",
    "**REFER TO TOP OF AGREEMENT**",
    "Recommended to be completed prior to transfer",
    "Recommended; Not required for admission"
}
SECTION_NOTES = {"A substitute course may be available for this major only", "Consult an adviser",
                 "Must be taken for a letter  grade", "Proficiency determined by placement exam(s)"} | GUIDANCE_NOTES
GROUP_NOTES = GUIDANCE_NOTES


def source_digest(value):
    """Bind reviewed classifications to source content, independent of JSON whitespace."""
    return hashlib.sha256(json.dumps(json.loads(value), sort_keys=True,
                                    separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()


def get_reviewed_profile(agreement):
    with PROFILES_PATH.open(encoding="utf-8") as file:
        profiles = json.load(file)
    identity = (agreement["name"], json.loads(agreement["sendingInstitution"])["id"],
                json.loads(agreement["receivingInstitution"])["id"], json.loads(agreement["academicYear"])["id"])
    for profile in profiles:
        if identity != (profile["major"], profile["sending_institution_id"],
                        profile["receiving_institution_id"], profile["academic_year_id"]):
            continue
        if (agreement["publishDate"] != profile["source_publish_date"] or
                source_digest(agreement["templateAssets"]) != profile["template_sha256"] or
                source_digest(agreement["articulations"]) != profile["articulations_sha256"]):
            raise ValueError("Reviewed agreement profile needs checking against the changed source")
        return profile
    return {}


def get_agreement_headings(agreement, assets, profile=None):
    """Resolve ambiguous titles only for an explicitly reviewed publication."""
    headings = dict(HEADINGS)
    for heading, category in (profile or {}).get("headings", {}).items():
        if category not in {"required", "major_required", "highly_recommended"}:
            raise ValueError("Reviewed heading has an unsupported category")
        headings[heading] = category
    with HEADING_RULES_PATH.open(encoding="utf-8") as file:
        rules = json.load(file)
    receiving = json.loads(agreement["receivingInstitution"])
    sending = json.loads(agreement["sendingInstitution"])
    year = json.loads(agreement["academicYear"])
    for rule in rules:
        if (agreement["name"], sending["id"], receiving["id"], year["id"]) != (
                rule["major"], rule["sending_institution_id"],
                rule["receiving_institution_id"], rule["academic_year_id"]):
            continue
        if agreement["publishDate"] != rule["source_publish_date"]:
            raise ValueError("Reviewed heading rule needs checking against the new publication")
        if not any(rule["source_instruction"] in plain_text(asset["content"])
                   for asset in assets if asset["area"] == "General" and asset["type"] == "GeneralText"):
            raise ValueError("Reviewed heading instruction is absent from the source")
        if not any(asset["type"] == "RequirementTitle" and asset["area"] == "Requirements"
                   and asset["content"].strip().upper() == rule["heading"] for asset in assets):
            raise ValueError("Reviewed requirement heading is absent from the source")
        if rule["category"] not in {"required", "major_required", "highly_recommended"}:
            raise ValueError("Reviewed heading has an unsupported category")
        headings[rule["heading"]] = rule["category"]
    return headings


def get_receiving_label(cell):
    if cell["type"] == "GeneralEducation":
        name = cell.get("generalEducationArea", {}).get("name")
        if not isinstance(name, str) or not name.strip():
            raise ValueError("General education area must have a name")
        return name.strip()
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
        if sending["items"]:
            raise ValueError("University-only status conflicts with sending-course options")
        return "university_only"
    if reason in {"No Course Articulated", "This Course is Never Articulated"}:
        if sending["items"]:
            raise ValueError("No Course Articulated conflicts with sending-course options")
        return "no_course_articulated"
    if reason:
        raise ValueError(f"Unrecognized articulation reason: {reason}")
    if PARTIAL_NOTE in get_articulation_notes(articulation):
        return "partial"
    return "articulated" if sending["items"] else "no_course_articulated"


def build_options(articulation):
    if articulation is None:
        return []
    sending = articulation["sendingArticulation"]
    if articulation.get("templateOverrides"):
        # An override that repeats the exact effective mapping changes nothing.
        # Variant-specific alternative mappings still need a variant model.
        if any(override.get("sendingArticulation") != sending for override in articulation["templateOverrides"]):
            raise ValueError("Template overrides need review before conversion")
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
    if instruction.get("type") in {"CompleteFollowing", "CompleteAllCourses"}:
        if (instruction.get("selectionType") != "Complete" or
                set(instruction) - {"type", "position", "selectionType"}):
            raise ValueError("Complete-all section has unsupported instructions")
        return None
    amount = instruction.get("amount")
    if (set(instruction) - {"type", "position", "amount", "amountUnitType", "selectionType", "amountQuantifier"} or
            instruction["type"] not in {"NFollowing", "NFromUnits"} or
            instruction["amountUnitType"] not in {"Course", "CourseOrCombination", "Row"} or
            instruction["selectionType"] not in {"Complete", "Select"} or
            instruction.get("amountQuantifier", "None") not in {"None", "AtLeast"} or
            not isinstance(amount, (int, float)) or amount < 1 or int(amount) != amount):
        raise ValueError("Section has an unsupported completion rule")
    return int(amount)


def get_requirement_sections(group):
    """Return (rows, required_count) pairs supported by our flat group model."""
    items = sorted_by_position(group["sections"])
    if (group.get("advisements") or any(
            attribute["content"] not in GROUP_NOTES for attribute in group.get("attributes", [])) or any(
            item.get("attributes") and (item["type"] not in {"Section", "SectionHeader"} or any(
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
        if instruction.get("selectionType") not in {"Complete", "Select"}:
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
    profile = get_reviewed_profile(agreement)
    allow_review = profile.get("allow_review_groups", False)
    if profile.get("blocking_issues") and not allow_review:
        raise ValueError("Agreement needs a richer model: " + "; ".join(profile["blocking_issues"]))
    original_assets = assets
    original_articulations = json.loads(agreement["articulations"])
    headings = get_agreement_headings(agreement, assets, profile)
    articulations = json.loads(agreement["articulations"])
    assets, articulations, transformations = apply_template_rules(
        assets, articulations, profile, get_receiving_label, build_options,
        get_articulation_status, get_articulation_notes)
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
    receiving_course_titles = {}
    category = profile.get("initial_category")
    category_title = None
    section_numbers = {"required": 0, "highly_recommended": 0, "major_required": 0}
    used_cells = set()
    receiving_course_attributes = []
    receiving_cross_listed_courses = []
    section_headers = []
    calculation_issues = list(profile.get("blocking_issues", []))
    for asset in sorted_by_position(assets):
        if asset["area"] != "Requirements":
            continue
        if asset["type"] == "RequirementTitle":
            title = asset["content"].strip().upper()
            if title not in headings:
                raise ValueError(f"Unrecognized requirement heading: {title}")
            category = headings[title]
            category_title = asset["content"].strip()
            continue
        if asset["type"] != "RequirementGroup" or category is None:
            raise ValueError("Unsupported requirement asset or missing heading")
        row_context = {}
        section_category = category
        header_notes = []
        for section in sorted_by_position(asset["sections"]):
            if section["type"] == "SectionHeader":
                section_category = headings.get(section["content"].strip().upper(), section_category)
                header_notes = [a["content"] for a in sorted_by_position(section.get("attributes", []))]
                if any(note in {"Recommended; Not required for admission", "Recommended to be completed prior to transfer"}
                       for note in header_notes):
                    section_category = "highly_recommended"
                section_headers.append({
                    "category": section_category, "requirement_group_position": asset["position"],
                    "header": section
                })
            else:
                for row in section.get("rows", []):
                    row_context[id(row)] = (section_category, section, header_notes)
        group_issues = list(profile.get("blocking_issues", []))
        try:
            section_plans = get_requirement_sections(asset)
        except ValueError as error:
            if not allow_review:
                raise
            group_issues.append(str(error))
            section_plans = []
            for section in sorted_by_position(asset["sections"]):
                if section["type"] == "SectionHeader":
                    continue
                if section["type"] != "Section" or not section.get("rows"):
                    raise ValueError("Review groups still require ordinary nonempty sections")
                try:
                    count = get_required_count(section)
                except ValueError:
                    count = None
                section_plans.append((sorted_by_position(section["rows"]), count))
        for rows, required_count in section_plans:
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
            if group_issues:
                group["review_required"] = True
                group["note"] = review_group_note(asset, rows, row_context, group_issues)
                if category_title:
                    group["note"] = "Source heading: " + category_title + "\n" + group["note"]
                calculation_issues.extend(group_issues)
            section_notes = list(dict.fromkeys(
                [attribute["content"] for attribute in sorted_by_position(asset.get("attributes", []))] +
                [note for row in rows for note in row_context[id(row)][2]] +
                [attribute["content"] for row in rows
                 for attribute in row_context[id(row)][1].get("attributes", [])]))
            if section_notes:
                group["note"] = "\n".join(filter(None, [group.get("note"), *section_notes]))
            result["groups"].append(group)
            requirement_count = 0
            labels = {}
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
                mapping_issue = None
                try:
                    options = build_options(articulation)
                    articulation_status = get_articulation_status(articulation)
                except ValueError as error:
                    if not allow_review:
                        raise
                    options = []
                    articulation_status = "review_required"
                    mapping_issue = human_review_reason(str(error))
                if cell["type"] == "GeneralEducation":
                    if not allow_review:
                        raise ValueError("General education areas need their separate course agreement")
                    articulation_status = "review_required"
                    mapping_issue = "General education area: consult the separate general education agreement for eligible courses."
                notes = get_articulation_notes(articulation)
                if mapping_issue:
                    group["review_required"] = True
                    group["note"] = "\n".join(filter(None, [group.get("note"), f"{label}: {mapping_issue}"]))
                    notes.append("Adviser review needed: " + mapping_issue)
                    calculation_issues.append(mapping_issue)
                requirement = {
                    "text": label,
                    "group": group_name,
                    "category": group_category,
                    "articulation_status": articulation_status,
                    "note": "\n".join(notes) if notes else None,
                    "options": options
                }
                receiving_courses = ([cell["course"]] if cell["type"] == "Course"
                                     else cell["series"]["courses"] if cell["type"] == "Series" else [])
                for course in receiving_courses:
                    course = course.get("course", course)
                    title = plain_text(course.get("courseTitle") or "")
                    if title:
                        receiving_course_titles[get_course_code(course)] = title
                if group_category == "major_required" and cell["type"] == "Course":
                    requirement["department"] = cell["course"].get("department")
                if label in labels:
                    previous = labels[label]
                    if not allow_review:
                        raise ValueError("Duplicate receiving labels in one group need review before counting")
                    # Count a cross-listed/repeated receiving course once. Keep
                    # all source mappings in the native review snapshot.
                    previous["articulation_status"] = "review_required"
                    previous["options"] = []
                    previous["note"] = "Repeated template entries for this course need review; it is counted once."
                    group["review_required"] = True
                    group["note"] = "\n".join(filter(None, [group.get("note"), previous["note"]]))
                    calculation_issues.append(previous["note"])
                    continue
                labels[label] = requirement
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

    if receiving_course_titles:
        result["receiving_course_titles"] = receiving_course_titles

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
    if transformations:
        result["source"]["reviewed_template_transformations"] = transformations
    if allow_review:
        result["source"]["native_requirements"] = [a for a in original_assets if a["area"] == "Requirements"]
        result["source"]["native_articulations"] = original_articulations
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
    if any(group.get("review_required") for group in result["groups"]):
        result["calculation_review_required"] = True
        result["review_required"] = True
        result["review_notes"].append(
            "Groups marked for adviser review cannot be calculated as complete. "
            "Their source rules, alternatives, and mappings are retained for review.")
        result["review_notes"].extend(dict.fromkeys(human_review_reason(issue) for issue in calculation_issues))
    return result


def review_group_note(asset, rows, row_context, issues):
    """Explain a non-evaluable group without replacing its native rule."""
    instructions = [asset.get("instruction")] + [
        instruction for row in rows for instruction in row_context[id(row)][1].get("advisements", [])]
    details = []
    for instruction in instructions:
        if not instruction:
            continue
        if instruction.get("amount") is not None:
            details.append(f"{instruction.get('selectionType', 'Complete')} "
                           f"{instruction['amount']:g} {instruction.get('amountUnitType', 'items')}")
        elif instruction.get("conjunction"):
            details.append("Sections joined by " + instruction["conjunction"].upper())
    detail = "; ".join(dict.fromkeys(details))
    return "\n".join(["Adviser review needed. This group cannot be marked complete automatically.",
                      *(["Source instruction: " + detail] if detail else []),
                      *dict.fromkeys(human_review_reason(issue) for issue in issues)])


def human_review_reason(message):
    reasons = {
        "Unsupported relationship between sections": "The source uses area or quantity conditions across sections. Confirm which areas and courses to choose.",
        "Section has an unsupported completion rule": "The source counts a sequence, areas, or units. A simple count of completed courses cannot verify this rule.",
        "Empty sections or group/section instructions need review": "Additional group or section instructions apply. Review the source notes before choosing courses.",
        "Multiple sections need an explicit relationship": "Confirm how the listed sections fit together before using this group as a checklist.",
        "OR between compound sections needs a nested model": "Choose one complete alternative section; do not combine incomplete alternatives.",
        "Option conjunctions are missing or unsupported": "The source lists multiple course groups without an explicit relationship. Confirm the acceptable course combinations.",
        "Template overrides need review before conversion": "Accepted courses depend on the agreement variant. Confirm which variant applies.",
        "Unrecognized articulation reason: Articulates as a Series Only": "These courses articulate only as a complete series. Confirm the entire sequence."
    }
    return reasons.get(message, message)


def write_json_atomic(path, payload):
    path = Path(path)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                         prefix=f".{path.name}.", suffix=".tmp", delete=False) as file:
            temporary = Path(file.name)
            json.dump(payload, file, indent=2, ensure_ascii=False)
            file.write("\n")
        temporary.replace(path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def build_review_package(agreement, conversion_error):
    """Retain every native rule and mapping without presenting it as evaluable.

    This is a review document, not a successful flat-model conversion. It has a
    distinct kind, output directory, batch status, and importer rejection.
    """
    assets = json.loads(agreement["templateAssets"])
    mappings = json.loads(agreement["articulations"])
    receiving = json.loads(agreement["receivingInstitution"])
    sending = json.loads(agreement["sendingInstitution"])
    year = json.loads(agreement["academicYear"])
    if not isinstance(assets, list) or not isinstance(mappings, list):
        raise ValueError("Review package requires valid template and articulation lists")
    issues = [{"location": "agreement", "message": str(conversion_error)}]
    tree = []
    title = None
    cell_ids = []
    for asset in sorted_by_position(assets):
        if asset["area"] != "Requirements":
            continue
        if asset["type"] == "RequirementTitle":
            title = plain_text(asset["content"])
            continue
        if asset["type"] != "RequirementGroup":
            issues.append({"location": f"asset:{asset['position']}", "message": f"Unsupported asset: {asset['type']}"})
            continue
        location = f"group:{asset['position']}"
        group = {"source_position": asset["position"], "title": title,
                 "instruction": asset.get("instruction"), "advisements": asset.get("advisements", []),
                 "attributes": asset.get("attributes", []), "sections": []}
        try:
            get_requirement_sections(asset)
        except ValueError as error:
            issues.append({"location": location, "message": str(error)})
        for section in sorted_by_position(asset["sections"]):
            normalized = {key: value for key, value in section.items() if key != "rows"}
            normalized["rows"] = []
            for row in sorted_by_position(section.get("rows", [])):
                normalized_row = {key: value for key, value in row.items() if key != "cells"}
                normalized_row["cells"] = []
                for cell in sorted_by_position(row["cells"]):
                    cell_ids.append(cell["id"])
                    try:
                        label = get_receiving_label(cell)
                    except ValueError as error:
                        label = cell.get("generalEducationArea", {}).get("name", cell["type"])
                        issues.append({"location": f"cell:{cell['id']}", "message": str(error)})
                    normalized_row["cells"].append({"id": cell["id"], "label": label, "type": cell["type"]})
                normalized["rows"].append(normalized_row)
            group["sections"].append(normalized)
        tree.append(group)
    mapped_ids = []
    for mapping in mappings:
        cell_id = mapping["templateCellId"]
        mapped_ids.append(cell_id)
        try:
            build_options(mapping["articulation"])
            get_articulation_status(mapping["articulation"])
        except ValueError as error:
            issues.append({"location": f"articulation:{cell_id}", "message": str(error)})
    if len(cell_ids) != len(set(cell_ids)) or len(mapped_ids) != len(set(mapped_ids)):
        issues.append({"location": "agreement", "message": "Duplicate template cells or articulation mappings"})
    if set(mapped_ids) - set(cell_ids):
        issues.append({"location": "agreement", "message": "Articulations reference cells absent from the template"})
    return {
        "kind": "review_required", "calculable": False,
        "university": receiving["names"][0]["name"], "major": agreement["name"],
        "college": "Mt. San Antonio College" if sending["id"] == 62 else sending["names"][0]["name"],
        "academic_year": year["code"].replace("-", "–"),
        "groups": [], "requirements": [], "review_required": True,
        "import_blockers": issues, "requirement_tree": tree,
        "source": {"system": "ASSIST", "publish_date": agreement["publishDate"],
                   "sending_institution_id": sending["id"], "receiving_institution_id": receiving["id"],
                   "academic_year_id": year["id"], "original_agreement": agreement}
    }


def convert_file(input_path, output_path, reviewed_rules=None):
    if Path(input_path).resolve() == Path(output_path).resolve():
        raise ValueError("Input and output must be different files")
    if reviewed_rules is None:
        with open(REVIEWED_RULES_PATH, encoding="utf-8") as file:
            reviewed_rules = json.load(file)
    agreement = build_agreement(load_assist_response(input_path), reviewed_rules)
    write_json_atomic(output_path, agreement)
    return agreement


def convert_folder(input_folder, output_folder, include_review=False):
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
    report = {"converted": 0, "failed": 0, "review_required": 0,
              "calculation_review_required": 0, "files": []}
    if include_review:
        report["blocked"] = 0
    for input_path in inputs:
        output_path = output_folder / f"{input_path.stem}_generated.json"
        try:
            agreement = convert_file(input_path, output_path, reviewed_rules)
        except Exception as error:
            # Each file is independent. Record the error type as well as its
            # message so unexpected parser failures remain visible for review.
            # Only valid source data rejected for semantic reasons can become a
            # review package. Bad JSON and I/O/programming failures stay failures.
            if include_review and isinstance(error, ValueError) and not isinstance(error, json.JSONDecodeError):
                try:
                    package = build_review_package(load_assist_response(input_path), error)
                    review_path = output_folder / "_review" / f"{input_path.stem}_review.json"
                    review_path.parent.mkdir(exist_ok=True)
                    write_json_atomic(review_path, package)
                except Exception as review_error:
                    error = review_error
                else:
                    report["blocked"] += 1
                    report["files"].append({
                        "input": str(input_path), "status": "blocked", "output": None,
                        "review_output": str(review_path), "major": package["major"],
                        "import_blockers": package["import_blockers"]
                    })
                    continue
            report["failed"] += 1
            report["files"].append({
                "input": str(input_path), "status": "failed", "output": None,
                "error_type": type(error).__name__, "error": str(error)
            })
        else:
            report["converted"] += 1
            report["review_required"] += int(agreement["review_required"])
            report["calculation_review_required"] += int(agreement.get("calculation_review_required", False))
            report["files"].append({
                "input": str(input_path), "status": "converted", "output": str(output_path),
                "groups": len(agreement["groups"]), "requirements": len(agreement["requirements"]),
                "review_required": agreement["review_required"], "review_notes": agreement["review_notes"],
                "calculation_review_required": agreement.get("calculation_review_required", False)
            })
    report_path = output_folder / "batch_report.json"
    write_json_atomic(report_path, report)
    print(f"Converted: {report['converted']}; failed: {report['failed']}; "
          f"converted agreements needing review: {report['review_required']}; "
          f"agreements with non-evaluable groups: {report['calculation_review_required']}; "
          f"blocked review packages: {report.get('blocked', 0)}. Report: {report_path}")
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
    parser.add_argument("--include-review", action="store_true",
                        help="With --batch, preserve unsupported agreements as blocked review packages")
    args = parser.parse_args()
    if args.include_review and not args.batch:
        parser.error("--include-review requires --batch")
    try:
        if args.batch:
            report = convert_folder(args.input, args.output, include_review=args.include_review)
            raise SystemExit(1 if report["failed"] or report.get("blocked") else 0)
        main(args.input, args.output)
    except (OSError, ValueError) as error:
        parser.error(str(error))
