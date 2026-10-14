import copy
import json
import unittest
from pathlib import Path

from transferplanner.scraper.articulation_parser import build_agreement, load_assist_response


DATA = Path(__file__).resolve().parents[2] / "data"


class ArticulationParserTests(unittest.TestCase):
    def setUp(self):
        self.raw = load_assist_response(DATA / "raw/berkeley_cs_2026_2027.json")

    def test_generated_core_matches_reviewed_manual_agreement(self):
        actual = build_agreement(self.raw)
        expected = json.loads((DATA / "berkeley_cs_2026_2027.json").read_text())
        for key, value in expected.items():
            self.assertEqual(actual[key], value, key)

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


if __name__ == "__main__":
    unittest.main()
