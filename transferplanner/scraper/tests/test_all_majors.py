import contextlib
import copy
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from transferplanner.database.import_courses import import_agreement, is_group_satisfied
from transferplanner.scraper.articulation_parser import (
    REVIEWED_RULES_PATH, build_agreement, build_review_package, convert_folder,
    get_articulation_status, get_required_count, load_assist_response, write_json_atomic
)


DATA = Path(__file__).resolve().parents[2] / "data"


def raw(slug):
    return load_assist_response(next((DATA / "raw").glob(f"62_to_79_{slug}_*.json")))


class AllMajorsTests(unittest.TestCase):
    def test_economics_requires_a_complete_calculus_sequence(self):
        agreement = build_agreement(raw("economics_b_a"))
        calculus = next(r for r in agreement["requirements"] if "MATH 51" in r["text"])
        self.assertIn("MATH 16A AND MATH 16B", calculus["text"])
        self.assertIn("MATH 51 AND MATH 52", calculus["text"])
        self.assertEqual([o["courses"] for o in calculus["options"]], [["MATH 180", "MATH 181"]])
        self.assertFalse(any(set(o["courses"]) <= {"MATH 180"} for o in calculus["options"]))
        self.assertIn("reviewed_template_transformations", agreement["source"])

    def test_political_science_keeps_admission_and_additional_alternative_separate(self):
        agreement = build_agreement(raw("political_science_b_a"))
        required = next(g for g in agreement["groups"] if g["category"] == "required")
        self.assertEqual(required["required_count"], 2)
        additional = [r for r in agreement["requirements"] if r["category"] == "major_required"]
        self.assertEqual(len(additional), 1)
        self.assertEqual(additional[0]["text"], "(POL SCI 3) OR (DATA C8 AND POL SCI 88)")

    def test_profile_is_scoped_and_rejects_changed_course_data(self):
        source = raw("chinese_east_asian_languages_b_a")
        self.assertTrue(all(g["category"] == "major_required" for g in build_agreement(source)["groups"]))
        changed = copy.deepcopy(source)
        assets = json.loads(changed["templateAssets"])
        for asset in assets:
            for section in asset.get("sections", []):
                for row in section.get("rows", []):
                    for cell in row["cells"]:
                        cell["course"]["courseNumber"] = "999"
        changed["templateAssets"] = json.dumps(assets)
        with self.assertRaisesRegex(ValueError, "changed source"):
            build_agreement(changed)
        changed = copy.deepcopy(source)
        changed["name"] = "Unreviewed major"
        with self.assertRaisesRegex(ValueError, "Unrecognized requirement heading"):
            build_agreement(changed)

    def test_course_combinations_are_choices_but_units_are_not_course_counts(self):
        agreement = build_agreement(raw("electrical_computer_engineering_b_s"))
        choices = [g for g in agreement["groups"] if g["category"] == "required" and g["required_count"] == 1]
        self.assertEqual(len(choices), 1)
        members = [r for r in agreement["requirements"] if r["group"] == choices[0]["name"] and r["category"] == "required"]
        self.assertTrue(any("BIOLOGY 1A AND BIOLOGY 1AL" == r["text"] for r in members))
        with self.assertRaises(ValueError):
            get_required_count({"advisements": [{"type": "NFollowing", "amount": 9,
                "amountUnitType": "Unit", "selectionType": "Complete"}]})

    def test_unavailable_and_university_only_reasons_remain_distinct(self):
        self.assertEqual(get_articulation_status({"sendingArticulation": {
            "noArticulationReason": "This Course is Never Articulated", "items": []}}), "no_course_articulated")
        self.assertEqual(get_articulation_status({"sendingArticulation": {
            "noArticulationReason": "This course must be taken at the university after transfer", "items": []}}), "university_only")

    def test_data_science_preparation_exception_does_not_change_full_equivalence(self):
        rules = json.loads(REVIEWED_RULES_PATH.read_text())
        agreement = build_agreement(raw("data_science_b_a"), rules)
        math54 = next(r for r in agreement["requirements"] if r["text"] == "MATH 54")
        self.assertIn(["MATH 260", "MATH 290"], [o["courses"] for o in math54["options"]])
        self.assertIn(["MATH 260"], math54["preparation_options"])
        math = build_agreement(load_assist_response(DATA / "raw/berkeley_math_2026_2027.json"), rules)
        self.assertTrue(all("preparation_options" not in r for r in math["requirements"]))

    def test_all_95_sources_are_either_converted_or_preserved_as_blocked(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            report = convert_folder(DATA / "raw", directory, include_review=True)
            inputs = list((DATA / "raw").glob("*.json"))
            self.assertEqual(len(inputs), 95)
            self.assertEqual(len(report["files"]), len(inputs))
            self.assertEqual(report["failed"], 0)
            self.assertEqual(report["converted"], 95)
            self.assertEqual(report["blocked"], 0)
            self.assertEqual(report["calculation_review_required"], 31)
            self.assertEqual(report["converted"] + report["blocked"], len(inputs))
            for entry in report["files"]:
                original = load_assist_response(entry["input"])
                if entry["status"] == "converted":
                    result = json.loads(Path(entry["output"]).read_text())
                    self.assertEqual(result["major"], original["name"])
                    self.assertTrue(result["groups"] or result.get("kind") == "informational")
                    groups = {(g["category"], g["name"]): g for g in result["groups"]}
                    for requirement in result["requirements"]:
                        if requirement["articulation_status"] == "review_required":
                            self.assertTrue(groups[(requirement["category"], requirement["group"])]["review_required"])
                    if "native_requirements" in result["source"]:
                        self.assertEqual(result["source"]["native_requirements"], [
                            a for a in json.loads(original["templateAssets"]) if a["area"] == "Requirements"])
                        self.assertEqual(result["source"]["native_articulations"], json.loads(original["articulations"]))
                else:
                    self.assertEqual(entry["status"], "blocked")
                    self.assertIsNone(entry["output"])
                    result = json.loads(Path(entry["review_output"]).read_text())
                    self.assertEqual(result["source"]["original_agreement"], original)
                    self.assertEqual(result["kind"], "review_required")
                    self.assertFalse(result["calculable"])
                    self.assertTrue(result["import_blockers"])
                    self.assertEqual(len(result["requirement_tree"]), sum(
                        a["area"] == "Requirements" and a["type"] == "RequirementGroup"
                        for a in json.loads(original["templateAssets"])))

    def test_track_area_and_unit_rules_never_become_complete_all_checklists(self):
        for slug in ["spanish_and_portuguese_b_a", "geography_b_a", "industrial_engineering_operations_research_b_s"]:
            agreement = build_agreement(raw(slug))
            self.assertTrue(agreement["calculation_review_required"])
            flagged = [g for g in agreement["groups"] if g.get("review_required")]
            self.assertTrue(flagged)
            for group in flagged:
                self.assertFalse(is_group_satisfied({**group, "requirements": {}}, ["MATH 180"]))
                self.assertTrue(group["note"])

    def test_unreviewed_future_source_still_gets_a_distinct_blocked_package(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            directory = Path(directory)
            inputs = directory / "raw"
            inputs.mkdir()
            response = json.loads((DATA / "raw/berkeley_math_2026_2027.json").read_text())
            assets = json.loads(response["result"]["templateAssets"])
            next(a for a in assets if a["type"] == "RequirementTitle")["content"] = "An unreviewed future heading"
            response["result"]["templateAssets"] = json.dumps(assets)
            (inputs / "future.json").write_text(json.dumps(response))
            report = convert_folder(inputs, directory / "out", include_review=True)
            self.assertEqual((report["converted"], report["blocked"], report["failed"]), (0, 1, 0))
            package = json.loads(Path(report["files"][0]["review_output"]).read_text())
            self.assertEqual(package["kind"], "review_required")
            self.assertEqual(package["source"]["original_agreement"], response["result"])

    def test_review_packages_cannot_query_or_write_the_database(self):
        package = build_review_package(raw("spanish_and_portuguese_b_a"), "Alternative concentrations")
        cursor = Mock()
        with self.assertRaisesRegex(ValueError, "blocked for review"):
            import_agreement(cursor, package)
        cursor.execute.assert_not_called()

    def test_bad_source_json_remains_a_failure_in_review_mode(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            directory = Path(directory)
            inputs = directory / "raw"
            inputs.mkdir()
            (inputs / "broken.json").write_text("{broken")
            (inputs / "unsuccessful.json").write_text('{"isSuccessful": false}')
            report = convert_folder(inputs, directory / "out", include_review=True)
            self.assertEqual((report["converted"], report["blocked"], report["failed"]), (0, 0, 2))

    def test_failed_atomic_write_preserves_previous_generated_result(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "agreement.json"
            path.write_text("previous result")
            with patch.object(Path, "replace", side_effect=OSError("disk failure")):
                with self.assertRaises(OSError):
                    write_json_atomic(path, {"new": "result"})
            self.assertEqual(path.read_text(), "previous result")
            self.assertEqual(list(Path(directory).iterdir()), [path])


if __name__ == "__main__":
    unittest.main()
