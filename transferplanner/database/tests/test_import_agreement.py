"""Database integration tests; each test rolls back its isolated schema."""
import copy
import contextlib
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

from transferplanner.database.import_courses import (
    build_major_plan, get_major_requirements, import_agreement, import_agreements, is_category_satisfied
)

DATA = Path(__file__).resolve().parents[2] / "data"
SCHEMA = Path(__file__).resolve().parents[1] / "schema.sql"
SCRIPT = Path(__file__).resolve().parents[1] / "import_courses.py"


class BatchInputTests(unittest.TestCase):
    def test_bad_json_and_missing_files_are_each_reported_without_opening_database(self):
        with tempfile.TemporaryDirectory() as directory:
            bad = Path(directory) / "bad.json"
            missing = Path(directory) / "missing.json"
            bad.write_text("{broken")
            with patch("transferplanner.database.import_courses.connect_to_database") as connect:
                with contextlib.redirect_stdout(io.StringIO()):
                    report = import_agreements([bad, missing])
                connect.assert_not_called()
            self.assertEqual((report["imported"], report["failed"]), (0, 2))
            self.assertEqual([item["error_type"] for item in report["files"]], ["JSONDecodeError", "FileNotFoundError"])

    def test_cli_accepts_multiple_paths_and_returns_failure_after_processing_each(self):
        with tempfile.TemporaryDirectory() as directory:
            paths = [Path(directory) / "missing_a.json", Path(directory) / "missing_b.json"]
            result = subprocess.run([sys.executable, str(SCRIPT), *map(str, paths)],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 1, result.stderr)
            for path in paths:
                self.assertIn(f"Failed {path}", result.stdout)
            self.assertIn("0 succeeded; 2 failed", result.stdout)


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
        self.additional = [json.loads((DATA / f"generated/berkeley_{name}_2026_2027_generated.json").read_text())
                           for name in ["aframestudies", "amerstudies", "ancgreekromanciv"]]
        self.cursor.execute("INSERT INTO colleges (name) VALUES (%s) RETURNING id", (self.math["college"],))
        college_id = self.cursor.fetchone()[0]
        self.cursor.execute("INSERT INTO universities (name) VALUES (%s)", (self.math["university"],))
        codes = set()
        for agreement in [self.math, self.cs, *self.additional]:
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

    @contextlib.contextmanager
    def isolated_connection(self):
        # Savepoints exercise per-file commit/rollback behavior while the outer
        # test transaction keeps every change inside this disposable schema.
        with self.connection.transaction():
            yield self.connection

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

    def test_batch_continues_after_sql_failure_and_rolls_back_all_failed_file_rows(self):
        invalid = copy.deepcopy(self.math)
        invalid["major"] = "Invalid test major"
        # Fail late, after its major, groups, and earlier requirements are inserted.
        invalid["requirements"][-1]["options"][0]["option_number"] = None
        with tempfile.TemporaryDirectory() as directory:
            paths = []
            for index, agreement in enumerate([self.cs, invalid, self.math]):
                path = Path(directory) / f"{index}.json"
                path.write_text(json.dumps(agreement))
                paths.append(path)
            with patch("transferplanner.database.import_courses.connect_to_database", self.isolated_connection):
                with contextlib.redirect_stdout(io.StringIO()):
                    report = import_agreements(paths)
        self.assertEqual((report["imported"], report["failed"]), (2, 1))
        self.assertEqual([r["status"] for r in report["files"]], ["imported", "failed", "imported"])
        self.assertEqual(report["files"][1]["error_type"], "NotNullViolation")
        self.cursor.execute("SELECT name FROM majors ORDER BY name")
        self.assertEqual([row[0] for row in self.cursor.fetchall()], sorted([self.cs["major"], self.math["major"]]))
        counts = self.counts()
        self.assertEqual(counts["major_requirement_groups"], 6)
        self.assertEqual(counts["major_requirements"], 14)
        self.assertTrue(self.get_rows(self.cs))
        self.assertTrue(self.get_rows(self.math))

    def test_batch_repeated_files_reuse_existing_agreement_without_duplicates(self):
        with patch("transferplanner.database.import_courses.connect_to_database", self.isolated_connection):
            with contextlib.redirect_stdout(io.StringIO()):
                report = import_agreements([DATA / "berkeley_cs_2026_2027_generated.json",
                                            DATA / "berkeley_math_2026_2027_generated.json",
                                            DATA / "berkeley_cs_2026_2027_generated.json"])
        self.assertEqual((report["imported"], report["failed"]), (3, 0))
        self.assertEqual(report["files"][0]["agreement_id"], report["files"][2]["agreement_id"])
        counts = self.counts()
        self.assertEqual(counts["majors"], 2)
        self.assertEqual(counts["major_requirements"], 14)

    def test_degree_rules_and_information_only_guidance_survive_sql_round_trip(self):
        for agreement in self.additional:
            agreement_id = import_agreement(self.cursor, agreement)
            self.cursor.execute("SELECT planner_metadata FROM articulation_agreements WHERE id = %s", (agreement_id,))
            metadata = self.cursor.fetchone()[0]
            self.assertTrue(metadata["notes"])
            if agreement.get("kind") == "informational":
                self.assertEqual(metadata["kind"], "informational")
                self.assertEqual(self.get_rows(agreement), [])
            elif agreement["major"] == "American Studies, B.A.":
                plan = build_major_plan(self.get_rows(agreement))
                self.assertNotIn("required", plan["categories"])
                groups = plan["categories"]["major_required"]
                self.assertTrue(groups["A"]["review_required"])
                self.assertEqual(groups["B"]["max_per_department"], 2)
                self.assertTrue(all(r.get("department") for r in groups["B"]["requirements"].values()))


if __name__ == "__main__":
    unittest.main()
