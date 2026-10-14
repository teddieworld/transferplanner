"""Database integration tests; each test rolls back its isolated schema."""
import copy
import json
import os
import unittest
import uuid
from pathlib import Path

from transferplanner.database.import_courses import (
    build_major_plan, get_major_requirements, import_agreement, is_category_satisfied
)

DATA = Path(__file__).resolve().parents[2] / "data"
SCHEMA = Path(__file__).resolve().parents[1] / "schema.sql"


@unittest.skipUnless(os.environ.get("TRANSFERPLANNER_TEST_DATABASE"), "Set TRANSFERPLANNER_TEST_DATABASE")
class AgreementImportTests(unittest.TestCase):
    def setUp(self):
        import psycopg
        from psycopg import sql

        self.connection = psycopg.connect(dbname=os.environ["TRANSFERPLANNER_TEST_DATABASE"], host="/tmp")
        self.addCleanup(self.connection.close)
        self.addCleanup(self.connection.rollback)
        self.cursor = self.connection.cursor()
        schema_name = "import_test_" + uuid.uuid4().hex
        self.cursor.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema_name)))
        self.cursor.execute(sql.SQL("SET LOCAL search_path TO {}").format(sql.Identifier(schema_name)))
        self.cursor.execute(SCHEMA.read_text())
        self.math = json.loads((DATA / "berkeley_math_2026_2027_generated.json").read_text())
        self.cs = json.loads((DATA / "berkeley_cs_2026_2027_generated.json").read_text())
        self.cursor.execute("INSERT INTO colleges (name) VALUES (%s) RETURNING id", (self.math["college"],))
        college_id = self.cursor.fetchone()[0]
        self.cursor.execute("INSERT INTO universities (name) VALUES (%s)", (self.math["university"],))
        codes = set()
        for agreement in [self.math, self.cs]:
            for requirement in agreement["requirements"]:
                for option in requirement["options"]:
                    codes.update(option["courses"])
                for option in requirement.get("preparation_options", []):
                    codes.update(option)
        for code in sorted(codes):
            self.cursor.execute("""
                INSERT INTO courses (college_id, code, title, min_units, max_units, uc_transferable, csu_transferable)
                VALUES (%s, %s, %s, 3, 3, true, true)
            """, (college_id, code, code))

    def get_rows(self, agreement):
        return get_major_requirements(self.cursor, agreement["university"], agreement["major"],
                                      agreement["academic_year"], agreement["college"])

    def counts(self):
        result = {}
        for table in ["courses", "course_requirements", "majors", "articulation_agreements",
                      "major_requirement_groups", "major_requirements", "major_requirement_options",
                      "major_requirement_option_courses"]:
            from psycopg import sql
            self.cursor.execute(sql.SQL("SELECT count(*) FROM {}").format(sql.Identifier(table)))
            result[table] = self.cursor.fetchone()[0]
        return result

    def test_repeated_math_import_has_no_duplicates_and_leaves_cs_unchanged(self):
        import_agreement(self.cursor, self.cs)
        cs_before = self.get_rows(self.cs)
        catalog_count = self.counts()["courses"]
        first_id = import_agreement(self.cursor, self.math)
        before = self.counts()
        self.assertEqual(import_agreement(self.cursor, self.math), first_id)
        self.assertEqual(self.counts(), before)
        self.assertEqual(self.get_rows(self.cs), cs_before)
        self.assertEqual(before["courses"], catalog_count)
        self.assertEqual(before["course_requirements"], 0)
        self.assertEqual(before["articulation_agreements"], 2)
        self.assertEqual(before["major_requirement_groups"], 6)
        self.assertEqual(before["major_requirements"], 14)
        math_required = build_major_plan(self.get_rows(self.math))["categories"]["required"]
        cs_required = build_major_plan(self.get_rows(self.cs))["categories"]["required"]
        completed = ["MATH 180", "MATH 181", "MATH 280", "MATH 260"]
        self.assertFalse(is_category_satisfied(math_required, completed))
        self.assertTrue(is_category_satisfied(cs_required, completed))
        self.assertTrue(is_category_satisfied(math_required, completed + ["MATH 290"]))
        self.assertTrue(is_category_satisfied(math_required, ["MATH 180", "MATH 181", "MATH 280", "ENGR 285"]))

    def test_missing_course_stops_import_before_agreement_rows_are_written(self):
        self.cursor.execute("DELETE FROM courses WHERE code = %s", ("MATH 290",))
        before = self.counts()
        with self.assertRaisesRegex(ValueError, "MATH 290"):
            import_agreement(self.cursor, self.math)
        self.assertEqual(self.counts(), before)

    def test_empty_option_cannot_become_automatically_satisfied(self):
        altered = copy.deepcopy(self.math)
        altered["requirements"][0]["options"][0]["courses"] = []
        before = self.counts()
        with self.assertRaisesRegex(ValueError, "Option must contain course codes"):
            import_agreement(self.cursor, altered)
        self.assertEqual(self.counts(), before)


if __name__ == "__main__":
    unittest.main()
