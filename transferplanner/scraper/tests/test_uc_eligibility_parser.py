import copy
import unittest

from transferplanner.scraper.uc_eligibility_parser import normalize


def course(code, area, note_id):
    return {"identifier": code, "courseTitle": code, "transferAreas": [{"areaType": 2, "code": area}], "footnoteParentIds": [note_id]}


class EligibilityParserTests(unittest.TestCase):
    def setUp(self):
        self.payload = {
            "listType": 2, "institutionName": "Mount San Antonio College",
            "academicYear": {"id": 76, "code": "2025-2026"},
            "courseInformationList": [course("BIOL 1", "UC-S", 1), course("BIOL 2", "UC-S", 1), course("BTNY 3", "UC-S", 2)],
            "footnotes": [
                {"footnoteParentId": 1, "footnoteText": "BIOL 1, BIOL 2 and BTNY 3 combined: maximum credit, 8 units"},
                {"footnoteParentId": 2, "footnoteText": "BTNY 3, BIOL 1 and BIOL 2 combined: maximum credit, 8 units"}
            ]
        }

    def test_shared_limits_include_courses_named_under_another_footnote_id(self):
        result = normalize(self.payload)
        self.assertEqual(result["limits"], [{"codes": ["BIOL 1", "BIOL 2", "BTNY 3"], "maxCourses": 2}])
        self.assertEqual(result["courses"]["BIOL 1"]["areas"], ["UC-S"])
        self.assertEqual(result["academicYear"], "2025-2026")

    def test_different_institution_year_unknown_areas_and_duplicate_codes_fail(self):
        for key, value in [("institutionName", "Another College"), ("listType", 1), ("academicYear", {"id": 77, "code": "2026-2027"})]:
            invalid = copy.deepcopy(self.payload)
            invalid[key] = value
            with self.assertRaises(ValueError):
                normalize(invalid)
        invalid = copy.deepcopy(self.payload)
        invalid["courseInformationList"][0]["transferAreas"][0]["code"] = "IGETC-5"
        with self.assertRaises(ValueError):
            normalize(invalid)
        invalid = copy.deepcopy(self.payload)
        invalid["courseInformationList"].append(invalid["courseInformationList"][0])
        with self.assertRaises(ValueError):
            normalize(invalid)


if __name__ == "__main__":
    unittest.main()
