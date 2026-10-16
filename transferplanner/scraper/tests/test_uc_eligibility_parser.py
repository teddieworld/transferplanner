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

    def test_approval_ranges_keep_blank_and_missing_terms_distinct(self):
        row = self.payload["courseInformationList"][0]
        row["beginTermCode"] = "F2025"
        row["endTermCode"] = ""
        row["transferAreas"][0].update(beginTermCode="", endTermCode="F2026")
        result = normalize(self.payload)["courses"]
        self.assertEqual(result["BIOL 1"]["courseBeginTerm"], "F2025")
        self.assertEqual(result["BIOL 1"]["courseEndTerm"], "")
        self.assertEqual(result["BIOL 1"]["approvals"], [{"area": "UC-S", "beginTerm": "", "endTerm": "F2026"}])
        self.assertIsNone(result["BIOL 2"]["approvals"][0]["beginTerm"])
        self.assertIsNone(result["BIOL 2"]["approvals"][0]["endTerm"])

    def test_single_course_algebra_limit_is_preserved(self):
        self.payload["courseInformationList"] = [course("MATH 130", "UC-M", 3), course("MATH 160", "UC-M", 3)]
        self.payload["footnotes"] = [{"footnoteParentId": 3, "footnoteText": "All College Algebra and Pre-Calculus courses limited to a single course with a maximum of 5 semester / 7.5 quarter units"}]
        result = normalize(self.payload)
        self.assertEqual(result["limits"], [{"codes": ["MATH 130", "MATH 160"], "maxCourses": 1}])
        self.assertEqual(result["courses"]["MATH 130"]["creditGroup"], result["courses"]["MATH 160"]["creditGroup"])


if __name__ == "__main__":
    unittest.main()
