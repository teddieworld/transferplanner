"""Normalize an ASSIST UC Transfer Admission Eligibility response, not a major agreement."""
import argparse
import json
import re
from pathlib import Path

AREAS = {"UC-E", "UC-M", "UC-H", "UC-B", "UC-S"}


def normalize(payload):
    if payload.get("listType") != 2 or payload.get("institutionName") != "Mount San Antonio College":
        raise ValueError("Expected Mount San Antonio College's UCTEL response")
    year = payload["academicYear"]
    if year.get("id") != 76 or year.get("code") != "2025-2026":
        raise ValueError("This snapshot is scoped to the 2025-2026 eligibility list")
    notes = {str(n["footnoteParentId"]): n["footnoteText"].strip() for n in payload["footnotes"]}
    courses = {}
    for row in payload["courseInformationList"]:
        code = row["identifier"]
        areas = sorted({a["code"] for a in row["transferAreas"] if a["areaType"] == 2})
        if not areas or not set(areas) <= AREAS or code in courses:
            raise ValueError(f"Missing, unsupported, or duplicate eligibility mapping: {code}")
        courses[code] = {
            "areas": areas, "title": row["courseTitle"],
            # Keep ASSIST's actual term codes. Missing fields (None) must not be
            # confused with explicit blanks, which mean open-ended applicability.
            "courseBeginTerm": row.get("beginTermCode"),
            "courseEndTerm": row.get("endTermCode"),
            "approvals": [{
                "area": a["code"], "beginTerm": a.get("beginTermCode"),
                "endTerm": a.get("endTermCode")
            } for a in row["transferAreas"] if a["areaType"] == 2],
            "notes": [notes[str(i)] for i in row["footnoteParentIds"]],
            "footnoteIds": [str(i) for i in row["footnoteParentIds"]]
        }
    if not courses:
        raise ValueError("Empty eligibility list")

    # Merge explicitly limited one-course families, including regular/honors versions.
    parent = {code: code for code in courses}

    def find(code):
        while parent[code] != code:
            code = parent[code]
        return code

    def join(codes):
        if codes:
            root = find(codes[0])
            for code in codes[1:]:
                parent[find(code)] = root

    def note_courses(note_id, note):
        explicit = {code for code in re.findall(r"\b[A-Z]{2,5}\s+[A-Z]?\d+[A-Z0-9]*\b", note) if code in courses}
        attached = {row["identifier"] for row in payload["courseInformationList"] if note_id in map(str, row["footnoteParentIds"])}
        return sorted(explicit | attached)

    for code, course in courses.items():
        if code.endswith("H") and "honors" in course["title"].lower() and code[:-1] in courses:
            join([code[:-1], code])
    for note_id, note in notes.items():
        if re.search(r"maximum credit,\s*1 course|limited to a single course", note, re.I):
            join(note_courses(note_id, note))
    for code, course in courses.items():
        course["creditGroup"] = find(code)
        del course["footnoteIds"]

    limits = []
    for note_id, note in notes.items():
        match = re.search(r"maximum credit,?\s*(\d+)\s*(course|unit)s?", note, re.I)
        if re.search(r"limited to a single course", note, re.I):
            limit = {"codes": note_courses(note_id, note), "maxCourses": 1}
            if limit["codes"] and limit not in limits:
                limits.append(limit)
            continue
        if not match:
            continue
        codes = note_courses(note_id, note)
        # Each college course in this pattern needs >=3 units; unit caps also bound its course count.
        max_courses = int(match[1]) if match[2].lower() == "course" else int(match[1]) // 3
        limit = {"codes": codes, "maxCourses": max_courses}
        if codes and limit not in limits:
            limits.append(limit)

    return {
        "institution": payload["institutionName"], "academicYear": year["code"],
        "sourceUrl": "https://assist.org/api/transferability/courses?institutionId=62&academicYearId=76&listType=UCTEL",
        "checkedOn": "2026-10-15",
        "availabilityNote": "ASSIST reported the 2026-2027 UCTEL list unavailable and displayed 2025-2026 instead.",
        "courses": dict(sorted(courses.items())), "limits": limits
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    result = normalize(json.loads(args.input.read_text()))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(f"Saved {len(result['courses'])} verified course designations for {result['academicYear']}")
