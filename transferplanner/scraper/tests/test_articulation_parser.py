import copy
import json
import unittest
from pathlib import Path

from transferplanner.scraper.articulation_parser import (
    build_agreement, get_requirement_sections, load_assist_response,
    get_articulation_status, get_required_count, plain_text
)


DATA = Path(__file__).resolve().parents[2] / "data"


class CognitiveScienceParserTests(unittest.TestCase):
    def setUp(self):
        self.raw = load_assist_response(DATA / "raw/62_to_79_cognitive_science_b_a_2026_2027.json")

    def test_required_choices_and_recommendations_keep_separate_counts(self):
        actual = build_agreement(self.raw)
        required = [g for g in actual["groups"] if g["category"] == "required"]
        self.assertEqual([g["required_count"] for g in required], [1, 1, 1])
        by_group = {(g["category"], g["name"]): [] for g in actual["groups"]}
        for requirement in actual["requirements"]:
            by_group[(requirement["category"], requirement["group"])].append(requirement["text"])
        self.assertEqual([by_group[("required", g["name"])] for g in required], [
            ["MATH 51", "MATH 16A"], ["DATA C8", "STAT 2", "STAT 20"], ["PSYCH C61", "PSYCH C64"]
        ])
        recommended = [g for g in actual["groups"] if g["category"] == "highly_recommended"]
        self.assertEqual([g["required_count"] for g in recommended], [None, 1, 1, 1])
        self.assertEqual(by_group[("highly_recommended", "A")], ["MATH 55"])
        self.assertTrue(all("General Information" in g["note"] for g in recommended))
        stat20 = next(r for r in actual["requirements"] if r["text"] == "STAT 20")
        self.assertEqual(stat20["options"], [])
        self.assertEqual(stat20["articulation_status"], "no_course_articulated")
        self.assertIn("No Course Articulated", stat20["note"])
        self.assertTrue(actual["review_required"])

    def test_reviewed_heading_requires_same_scope_publication_and_instruction(self):
        for key, value in [("name", "Another major"), ("publishDate", "2099-01-01")]:
            altered = copy.deepcopy(self.raw)
            altered[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                build_agreement(altered)
        for field in ("academicYear", "sendingInstitution", "receivingInstitution"):
            altered = copy.deepcopy(self.raw)
            identity = json.loads(altered[field])
            identity["id"] = 999
            altered[field] = json.dumps(identity)
            with self.subTest(field=field), self.assertRaises(ValueError):
                build_agreement(altered)
        altered = copy.deepcopy(self.raw)
        assets = json.loads(altered["templateAssets"])
        for asset in assets:
            if asset["type"] == "GeneralText":
                asset["content"] = plain_text(asset["content"]).replace(
                    "must be completed before transfer", "may be completed after transfer")
        altered["templateAssets"] = json.dumps(assets)
        with self.assertRaisesRegex(ValueError, "instruction is absent"):
            build_agreement(altered)

    def test_complete_following_means_all_rows_and_rejects_extra_rules(self):
        section = {"rows": [{"position": 1}, {"position": 0}], "advisements": [
            {"type": "CompleteFollowing", "selectionType": "Complete", "position": 0}
        ]}
        self.assertEqual(get_requirement_sections({"sections": [dict(section, type="Section", position=0)]}),
                         [([{"position": 0}, {"position": 1}], None)])
        section["advisements"][0]["amountUnitType"] = "Unit"
        with self.assertRaises(ValueError):
            get_required_count(section)

    def test_unknown_group_notes_and_contradictory_no_articulation_are_rejected(self):
        with self.assertRaises(ValueError):
            get_requirement_sections({"attributes": [{"content": "Complete six units"}], "sections": []})
        with self.assertRaisesRegex(ValueError, "conflicts"):
            get_articulation_status({"sendingArticulation": {
                "noArticulationReason": "No Course Articulated", "items": [{"type": "CourseGroup"}]
            }})


class ArticulationParserTests(unittest.TestCase):
    def setUp(self):
        self.raw = load_assist_response(DATA / "raw/berkeley_cs_2026_2027.json")

    def test_generated_core_matches_reviewed_manual_agreement(self):
        actual = build_agreement(self.raw)
        expected = json.loads((DATA / "berkeley_cs_2026_2027.json").read_text())
        for key, value in expected.items():
            self.assertEqual(actual[key], value, key)

    def test_receiving_titles_come_from_assist_without_changing_requirement_codes(self):
        actual = build_agreement(self.raw)
        self.assertEqual(actual["receiving_course_titles"]["MATH 51"], "Calculus I")
        self.assertEqual(actual["receiving_course_titles"]["MATH 54"], "Linear Algebra and Differential Equations")
        self.assertEqual(actual["requirements"][0]["text"], "MATH 51")
        self.assertEqual(actual["requirements"][0]["options"][0]["courses"], ["MATH 180"])

        series = build_agreement(load_assist_response(DATA / "raw/62_to_79_chemical_engineering_b_s_2026_2027.json"))
        labels = [r["text"] for r in series["requirements"] if " AND " in r["text"]]
        self.assertTrue(labels)
        for label in labels:
            for code in label.split(" AND "):
                self.assertTrue(series["receiving_course_titles"][code], code)

    def test_positions_determine_display_order_instead_of_array_order(self):
        altered = copy.deepcopy(self.raw)
        assets = json.loads(altered["templateAssets"])
        assets.reverse()
        for asset in assets:
            asset.get("sections", []).reverse()
            for section in asset.get("sections", []):
                section["rows"].reverse()
        altered["templateAssets"] = json.dumps(assets)
        mappings = json.loads(altered["articulations"])
        mappings.reverse()
        for mapping in mappings:
            groups = mapping["articulation"]["sendingArticulation"]["items"]
            groups.reverse()
            for group in groups:
                group["items"].reverse()
        altered["articulations"] = json.dumps(mappings)
        self.assertEqual(build_agreement(altered), build_agreement(self.raw))

    def test_general_instructions_and_publication_metadata_are_preserved(self):
        actual = build_agreement(self.raw)
        expected = [item for item in json.loads(self.raw["templateAssets"]) if item["area"] == "General"]
        expected.sort(key=lambda item: item["position"])
        self.assertEqual(actual["source"]["general_information"], expected)
        self.assertEqual(actual["source"]["publish_date"], self.raw["publishDate"])
        self.assertTrue(actual["review_required"])
        self.assertTrue(actual["review_notes"])

    def test_reviewed_exception_is_separate_and_agreement_specific(self):
        rules = json.loads((DATA / "reviewed_preparation_rules.json").read_text())
        actual = build_agreement(self.raw, rules)
        math54 = next(item for item in actual["requirements"] if item["text"] == "MATH 54")
        self.assertEqual([option["courses"] for option in math54["options"]], rules[0]["expected_equivalence_options"])
        self.assertEqual(math54["preparation_options"], [["ENGR 285"], ["MATH 285"], ["MATH 260"]])
        self.assertEqual(math54["preparation_note"], rules[0]["source_instruction"])
        another_major = copy.deepcopy(self.raw)
        another_major["name"] = "A different major"
        other = build_agreement(another_major, rules)
        self.assertTrue(all("preparation_options" not in item for item in other["requirements"]))

    def test_changed_publication_or_instruction_requires_another_review(self):
        rules = json.loads((DATA / "reviewed_preparation_rules.json").read_text())
        changed_date = copy.deepcopy(self.raw)
        changed_date["publishDate"] = "2026-10-09T00:00:00"
        with self.assertRaises(ValueError):
            build_agreement(changed_date, rules)
        changed_text = copy.deepcopy(self.raw)
        changed_text["templateAssets"] = changed_text["templateAssets"].replace("will&nbsp;accept", "will&nbsp;not&nbsp;accept")
        with self.assertRaises(ValueError):
            build_agreement(changed_text, rules)

    def test_python_plan_keeps_separate_statuses_for_the_same_requirement(self):
        from transferplanner.database.import_courses import (
            build_major_plan, get_requirement_status, get_preparation_status, is_group_satisfied
        )
        row = ["Berkeley", "CS", "B", 1, "MATH 54", 1, "required", "articulated",
               None, "MATH 260", "Linear Algebra", "equivalence", "Reviewed exception"]
        second_course = row.copy()
        second_course[9:11] = ["MATH 290", "Differential Equations"]
        preparation = row.copy()
        preparation[11] = "preparation"
        plan = build_major_plan([row, second_course, preparation])
        group = plan["categories"]["required"]["B"]
        requirement = group["requirements"]["MATH 54"]
        self.assertEqual(get_requirement_status(requirement, ["MATH 260"]), "not_satisfied")
        self.assertEqual(get_preparation_status(requirement, ["MATH 260"]), "satisfied")
        self.assertTrue(is_group_satisfied(group, ["MATH 260"]))
        self.assertFalse(is_group_satisfied(group, ["MATH 290"]))

    def test_missing_or_unknown_option_conjunction_does_not_become_an_or(self):
        for invalid in [[], [{"groupConjunction": "And"}]]:
            altered = copy.deepcopy(self.raw)
            mappings = json.loads(altered["articulations"])
            math54 = next(item for item in mappings if item["articulation"]["course"]["courseNumber"] == "54")
            math54["articulation"]["sendingArticulation"]["courseGroupConjunctions"] = invalid
            altered["articulations"] = json.dumps(mappings)
            with self.assertRaises(ValueError):
                build_agreement(altered)

    def test_unit_based_advisement_is_not_treated_as_course_count(self):
        altered = copy.deepcopy(self.raw)
        assets = json.loads(altered["templateAssets"])
        for asset in assets:
            for section in asset.get("sections", []):
                for advisement in section["advisements"]:
                    advisement["amountUnitType"] = "Unit"
        altered["templateAssets"] = json.dumps(assets)
        with self.assertRaises(ValueError):
            build_agreement(altered)

    def test_unknown_heading_does_not_inherit_the_previous_category(self):
        altered = copy.deepcopy(self.raw)
        assets = json.loads(altered["templateAssets"])
        next(item for item in assets if item["type"] == "RequirementTitle")["content"] = "Unknown category"
        altered["templateAssets"] = json.dumps(assets)
        with self.assertRaises(ValueError):
            build_agreement(altered)

    def test_section_header_is_preserved_without_changing_requirements(self):
        altered = copy.deepcopy(self.raw)
        assets = json.loads(altered["templateAssets"])
        group = next(a for a in sorted(assets, key=lambda a: a["position"]) if a["type"] == "RequirementGroup")
        for section in group["sections"]:
            section["position"] += 1
        header = {"type": "SectionHeader", "content": "Course preparation", "position": 0, "attributes": []}
        group["sections"].append(header)
        altered["templateAssets"] = json.dumps(assets)
        actual, expected = build_agreement(altered), build_agreement(self.raw)
        self.assertEqual(actual["groups"], expected["groups"])
        self.assertEqual(actual["requirements"], expected["requirements"])
        self.assertEqual(actual["source"]["section_headers"], [{
            "category": "required", "requirement_group_position": group["position"], "header": header
        }])
        self.assertTrue(actual["review_required"])

    def test_aerospace_reading_requirements_beneath_header_are_still_processed(self):
        raw = load_assist_response(DATA / "raw/berkeley_aeroeng_2026_2027.json")
        assets = json.loads(raw["templateAssets"])
        group = next(a for a in assets if a["type"] == "RequirementGroup" and
                     any(s["type"] == "SectionHeader" for s in a["sections"]))
        sections = get_requirement_sections(group)
        self.assertEqual([len(rows) for rows, count in sections], [6, 2, 9])
        self.assertEqual([count for rows, count in sections], [None, None, 1])
        reading_rows = sections[1][0]
        self.assertEqual([row["cells"][0]["requirement"]["name"] for row in reading_rows], [
            "Courses that satisfy Reading & Composition A", "Courses that satisfy Reading & Composition B"
        ])
        actual = build_agreement(raw)
        self.assertEqual([r["text"] for r in actual["requirements"] if r["group"] == "B" and
                          r["category"] == "required"], [
            "Courses that satisfy Reading & Composition A", "Courses that satisfy Reading & Composition B"
        ])

    def test_unrecognized_sections_and_header_rules_are_rejected(self):
        for item in [
            {"type": "UnknownSection", "position": 0},
            {"type": "SectionHeader", "position": 0, "advisements": [{"type": "NFollowing"}]},
            {"type": "SectionHeader", "position": 0, "attributes": [{"content": "Complete one"}]}
        ]:
            with self.subTest(item=item), self.assertRaises(ValueError):
                get_requirement_sections({"sections": [item]})


class MathematicsParserTests(unittest.TestCase):
    def setUp(self):
        self.raw = load_assist_response(DATA / "raw/berkeley_math_2026_2027.json")
        self.rules = json.loads((DATA / "reviewed_preparation_rules.json").read_text())

    def test_math_groups_preserve_required_alternative_and_recommended_courses(self):
        actual = build_agreement(self.raw, self.rules)
        self.assertEqual(actual["major"], "Mathematics/Applied Mathematics, B.A.")
        self.assertEqual(actual["groups"], [
            {"name": "A", "category": "required", "required_count": None},
            {"name": "B", "category": "required", "required_count": 1},
            {"name": "A", "category": "highly_recommended", "required_count": None}
        ])
        self.assertEqual([(r["text"], r["group"], r["category"]) for r in actual["requirements"]], [
            ("MATH 51", "A", "required"), ("MATH 52", "A", "required"),
            ("MATH 53", "A", "required"), ("MATH 54", "B", "required"),
            ("MATH 56", "B", "required"), ("MATH 55", "A", "highly_recommended")
        ])
        by_course = {r["text"]: r for r in actual["requirements"]}
        expected_options = {
            "MATH 51": [["MATH 180"]], "MATH 52": [["MATH 181"]],
            "MATH 53": [["MATH 280"]],
            "MATH 54": [["ENGR 285"], ["MATH 285"], ["MATH 260", "MATH 290"]],
            "MATH 56": [], "MATH 55": [["CSCI 190"]]
        }
        for code, options in expected_options.items():
            self.assertEqual([o["courses"] for o in by_course[code]["options"]], options)
            expected_status = "no_course_articulated" if code == "MATH 56" else "articulated"
            self.assertEqual(by_course[code]["articulation_status"], expected_status)
        self.assertTrue(all("preparation_options" not in r for r in actual["requirements"]))
        notes = actual["source"]["receiving_course_attributes"]
        self.assertEqual(notes[0]["course"], "MATH 55")
        self.assertEqual(notes[0]["course_attributes"][0]["content"], "Recommended; Not required for admission")

    def test_math_completion_requires_the_full_series_and_all_required_groups(self):
        from transferplanner.database.import_courses import build_major_plan, is_category_satisfied
        agreement = build_agreement(self.raw, self.rules)
        groups = {(g["category"], g["name"]): g for g in agreement["groups"]}
        rows = []
        for requirement in agreement["requirements"]:
            group = groups[(requirement["category"], requirement["group"])]
            for option in requirement["options"] or [{"option_number": None, "courses": [None]}]:
                for code in option["courses"]:
                    rows.append([
                        agreement["university"], agreement["major"], group["name"],
                        group["required_count"], requirement["text"], option["option_number"],
                        requirement["category"], requirement["articulation_status"],
                        requirement["note"], code, None, "equivalence", None
                    ])
        required = build_major_plan(rows)["categories"]["required"]
        calculus = ["MATH 180", "MATH 181", "MATH 280"]
        self.assertFalse(is_category_satisfied(required, calculus + ["MATH 260"]))
        self.assertFalse(is_category_satisfied(required, calculus + ["CSCI 190"]))
        self.assertTrue(is_category_satisfied(required, calculus + ["MATH 260", "MATH 290"]))
        self.assertTrue(is_category_satisfied(required, calculus + ["MATH 285"]))
        self.assertTrue(is_category_satisfied(required, calculus + ["ENGR 285"]))
        self.assertFalse(is_category_satisfied(required, ["MATH 285"]))

    def test_math_section_positions_survive_reordered_source_arrays(self):
        altered = copy.deepcopy(self.raw)
        assets = json.loads(altered["templateAssets"])
        assets.reverse()
        for asset in assets:
            asset.get("sections", []).reverse()
            for section in asset.get("sections", []):
                section["rows"].reverse()
        altered["templateAssets"] = json.dumps(assets)
        self.assertEqual(build_agreement(altered), build_agreement(self.raw))

    def test_compound_or_sections_are_not_flattened(self):
        for change in ("extra_row", "advisement"):
            altered = copy.deepcopy(self.raw)
            assets = json.loads(altered["templateAssets"])
            group = next(a for a in assets if a.get("instruction") and a["instruction"].get("conjunction") == "Or")
            section = group["sections"][0]
            if change == "extra_row":
                section["rows"].append(copy.deepcopy(section["rows"][0]))
            else:
                section["advisements"] = [{"type": "NFollowing", "amount": 1,
                    "amountUnitType": "Course", "selectionType": "Complete"}]
            altered["templateAssets"] = json.dumps(assets)
            with self.assertRaisesRegex(ValueError, "nested model"):
                build_agreement(altered)

    def test_multiple_sections_without_an_instruction_are_rejected(self):
        altered = copy.deepcopy(self.raw)
        assets = json.loads(altered["templateAssets"])
        group = next(a for a in assets if a["type"] == "RequirementGroup" and a["instruction"] is None)
        group["sections"].append(copy.deepcopy(group["sections"][0]))
        altered["templateAssets"] = json.dumps(assets)
        with self.assertRaisesRegex(ValueError, "explicit relationship"):
            build_agreement(altered)

    def test_unsupported_selection_and_section_instructions_require_review(self):
        for change in ("selection", "attributes"):
            altered = copy.deepcopy(self.raw)
            assets = json.loads(altered["templateAssets"])
            group = next(a for a in assets if a.get("instruction") and a["instruction"]["type"] == "Following")
            if change == "selection":
                group["instruction"]["selectionType"] = "Exclude"
            else:
                group["sections"][0]["attributes"] = [{"position": 0, "content": "An additional rule"}]
            altered["templateAssets"] = json.dumps(assets)
            with self.assertRaises(ValueError):
                build_agreement(altered)


class AerospaceParserTests(unittest.TestCase):
    def setUp(self):
        self.raw = load_assist_response(DATA / "raw/berkeley_aeroeng_2026_2027.json")
        self.rules = json.loads((DATA / "reviewed_preparation_rules.json").read_text())

    def test_all_aerospace_mappings_keep_their_course_combinations(self):
        actual = build_agreement(self.raw, self.rules)
        self.assertEqual(actual["major"], "Aerospace Engineering, B.S.")
        self.assertEqual(actual["academic_year"], "2026–2027")
        self.assertEqual([(g["category"], g["required_count"]) for g in actual["groups"]], [
            ("required", None), ("required", None), ("required", 1),
            ("highly_recommended", 1), ("highly_recommended", None), ("highly_recommended", 1)
        ])
        expected = {
            "MATH 51": [["MATH 180"]], "MATH 52": [["MATH 181"]], "MATH 53": [["MATH 280"]],
            "MATH 54": [["ENGR 285"], ["MATH 285"], ["MATH 260", "MATH 290"]],
            "PHYSICS 7A": [["PHYS 4A"]], "PHYSICS 7B": [["PHYS 4B"]],
            "Courses that satisfy Reading & Composition A": [["AMLA 1A"], ["ENGL C1000"], ["ENGL C1000H"]],
            "Courses that satisfy Reading & Composition B": [["ENGL C1001"], ["ENGL C1001H"]],
            "ASTRON 7A": [], "ASTRON 10": [["ASTR 5", "ASTR 5L"]],
            "BIOLOGY 1A AND BIOLOGY 1AL": [["BIOL 1", "BIOL 2"], ["BIOL 2", "BIOL 4"], ["BIOL 2", "BIOL 4H"]],
            "BIOLOGY 1B": [["BIOL 2", "BIOL 4"], ["BIOL 2", "BIOL 4H"]],
            "CHEM 1A AND CHEM 1AL AND CHEM 1B": [["CHEM 50", "CHEM 51"], ["CHEM 50H", "CHEM 51H"]],
            "CHEM 3A AND CHEM 3AL": [["CHEM 80"]], "CHEM 3B AND CHEM 3BL": [["CHEM 81"]],
            "MCELLBI 32 AND MCELLBI 32L": [["ANAT 36"]], "PHYSICS 7C": [["PHYS 4C"]],
            "ENGIN 7": [["ENGR 7"]], "COMPSCI 61A": [],
            "MAT SCI 45 AND MAT SCI 45L": [["ENGR 8"]],
            "MEC ENG C85": [["ENGR 40", "ENGR 42"]], "MEC ENG 40": [], "ENGIN 40": []
        }
        self.assertEqual(len(actual["requirements"]), 23)
        self.assertEqual({r["text"]: [o["courses"] for o in r["options"]] for r in actual["requirements"]}, expected)
        for requirement in actual["requirements"]:
            self.assertNotIn("preparation_options", requirement)
            self.assertEqual(requirement["articulation_status"],
                             "articulated" if expected[requirement["text"]] else "no_course_articulated")

    def test_aerospace_preparation_needs_both_reading_requirements_and_complete_science_option(self):
        from transferplanner.database.import_courses import build_major_plan, is_category_satisfied
        agreement = build_agreement(self.raw, self.rules)
        groups = {(g["category"], g["name"]): g for g in agreement["groups"]}
        rows = []
        for requirement in agreement["requirements"]:
            group = groups[(requirement["category"], requirement["group"])]
            for option in requirement["options"] or [{"option_number": None, "courses": [None]}]:
                for code in option["courses"]:
                    rows.append([agreement["university"], agreement["major"], group["name"],
                                 group["required_count"], requirement["text"], option["option_number"],
                                 requirement["category"], requirement["articulation_status"],
                                 requirement["note"], code, None, "equivalence", None])
        required = build_major_plan(rows)["categories"]["required"]
        base = ["MATH 180", "MATH 181", "MATH 280", "ENGR 285", "PHYS 4A", "PHYS 4B",
                "ENGL C1000", "ENGL C1001"]
        for extra, expected in [([], False), (["ASTR 5"], False), (["ASTR 5", "ASTR 5L"], True),
                                (["CHEM 50"], False), (["CHEM 50", "CHEM 51"], True),
                                (["BIOL 1"], False), (["BIOL 1", "BIOL 2"], True), (["ANAT 36"], True)]:
            with self.subTest(extra=extra):
                self.assertEqual(is_category_satisfied(required, base + extra), expected)
        self.assertTrue(is_category_satisfied(required, base[:-2] + ["AMLA 1A", "ENGL C1001H", "PHYS 4C"]))
        self.assertFalse(is_category_satisfied(required, base[:-1] + ["PHYS 4C"]))
        self.assertFalse(is_category_satisfied(required, [c for c in base if c != "ENGR 285"] + ["MATH 260", "PHYS 4C"]))

    def test_cross_listing_is_preserved_without_an_extra_requirement(self):
        actual = build_agreement(self.raw)
        aliases = actual["source"]["receiving_cross_listed_courses"]
        self.assertEqual(len(aliases), 1)
        self.assertEqual(aliases[0]["requirement"], "MEC ENG C85")
        self.assertEqual(aliases[0]["aliases"], ["CIV ENG C30"])
        self.assertNotIn("CIV ENG C30", [r["text"] for r in actual["requirements"]])
        self.assertTrue(actual["review_required"])

    def test_positions_control_series_and_or_course_order(self):
        altered = copy.deepcopy(self.raw)
        assets = json.loads(altered["templateAssets"])
        assets.reverse()
        for asset in assets:
            asset.get("sections", []).reverse()
            for section in asset.get("sections", []):
                section.get("rows", []).reverse()
                for row in section.get("rows", []):
                    for cell in row["cells"]:
                        if cell["type"] == "Series":
                            cell["series"]["courses"].reverse()
        altered["templateAssets"] = json.dumps(assets)
        mappings = json.loads(altered["articulations"])
        mappings.reverse()
        for mapping in mappings:
            options = mapping["articulation"]["sendingArticulation"]["items"]
            options.reverse()
            for option in options:
                option["items"].reverse()
        altered["articulations"] = json.dumps(mappings)
        self.assertEqual(build_agreement(altered), build_agreement(self.raw))

    def test_unsupported_or_empty_receiving_structures_are_not_simplified(self):
        for change in ["series_or", "series_empty", "requirement_empty", "sending_unknown"]:
            altered = copy.deepcopy(self.raw)
            assets = json.loads(altered["templateAssets"])
            cells = [cell for a in assets for s in a.get("sections", [])
                     for row in s.get("rows", []) for cell in row["cells"]]
            if change == "series_or":
                next(c for c in cells if c["type"] == "Series")["series"]["conjunction"] = "Or"
            elif change == "series_empty":
                next(c for c in cells if c["type"] == "Series")["series"]["courses"] = []
            elif change == "requirement_empty":
                next(c for c in cells if c["type"] == "Requirement")["requirement"]["name"] = ""
            else:
                mappings = json.loads(altered["articulations"])
                mappings[0]["articulation"]["sendingArticulation"]["items"][0]["courseConjunction"] = "Unknown"
                altered["articulations"] = json.dumps(mappings)
            altered["templateAssets"] = json.dumps(assets)
            with self.subTest(change=change), self.assertRaises(ValueError):
                build_agreement(altered)


class AdditionalMajorTests(unittest.TestCase):
    def load(self, name):
        return load_assist_response(DATA / f"raw/berkeley_{name}_2026_2027.json")

    def test_admission_subheading_overrides_degree_heading(self):
        result = build_agreement(self.load("aframestudies"))
        self.assertEqual(result["groups"], [{"name": "A", "category": "required", "required_count": None}])
        self.assertEqual([r["text"] for r in result["requirements"]], ["AFRICAM 4A", "AFRICAM 5A", "AFRICAM 5B"])
        self.assertEqual(result["requirements"][0]["options"][0]["courses"], ["HIST 35"])

    def test_degree_rules_notes_and_wrapped_cross_listing_are_preserved(self):
        result = build_agreement(self.load("amerstudies"))
        self.assertTrue(all(g["category"] == "major_required" for g in result["groups"]))
        self.assertTrue(result["groups"][0]["review_required"])
        self.assertEqual(result["groups"][1]["required_count"], 3)
        self.assertEqual(result["groups"][1]["max_per_department"], 2)
        self.assertIn("Consult an adviser", result["groups"][1]["note"])
        self.assertTrue(all(r.get("department") for r in result["requirements"]))
        self.assertEqual(result["source"]["receiving_cross_listed_courses"][0]["aliases"], ["LNS C30U"])

    def test_guidance_only_response_is_explicitly_informational(self):
        result = build_agreement(self.load("ancgreekromanciv"))
        self.assertEqual(result["kind"], "informational")
        self.assertEqual(result["groups"], [])
        self.assertEqual(result["requirements"], [])
        self.assertTrue(result["source"]["general_information"])

    def test_changed_source_does_not_reuse_department_rules(self):
        raw = self.load("amerstudies")
        raw["publishDate"] = "2030-01-01"
        with self.assertRaisesRegex(ValueError, "Reviewed group rule"):
            build_agreement(raw)

    def test_python_department_limit_counts_valid_subsets(self):
        from transferplanner.database.import_courses import is_group_satisfied
        group = {"required_count": 3, "max_per_department": 2, "requirements": {
            code: {"articulation_status": "articulated", "department": "History" if code != "D" else "Sociology",
                   "options": {1: {"courses": [{"code": code}]}}} for code in "ABCD"
        }}
        self.assertFalse(is_group_satisfied(group, list("ABC")))
        self.assertTrue(is_group_satisfied(group, list("ABD")))
        self.assertTrue(is_group_satisfied(group, list("ABCD")))
        self.assertFalse(is_group_satisfied({**group, "review_required": True}, list("ABCD")))


if __name__ == "__main__":
    unittest.main()
