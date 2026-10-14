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


if __name__ == "__main__":
    unittest.main()
