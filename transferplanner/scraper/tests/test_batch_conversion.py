import contextlib
import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from transferplanner.scraper.articulation_parser import convert_folder


DATA = Path(__file__).resolve().parents[2] / "data"
SCRIPT = Path(__file__).resolve().parents[1] / "articulation_parser.py"


class BatchConversionTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.inputs = self.root / "raw"
        self.outputs = self.root / "generated"
        self.inputs.mkdir()

    def save_sample(self, major, filename):
        (self.inputs / filename).write_bytes((DATA / f"raw/berkeley_{major}_2026_2027.json").read_bytes())

    def convert(self):
        with contextlib.redirect_stdout(io.StringIO()):
            return convert_folder(self.inputs, self.outputs)

    def test_mixed_files_report_errors_continue_and_preserve_review_notes(self):
        self.save_sample("cs", "01_cs.json")
        unsupported = json.loads((DATA / "raw/berkeley_math_2026_2027.json").read_text())
        assets = json.loads(unsupported["result"]["templateAssets"])
        next(a for a in assets if a["type"] == "RequirementTitle")["content"] = "Unsupported heading"
        unsupported["result"]["templateAssets"] = json.dumps(assets)
        (self.inputs / "02_unsupported.json").write_text(json.dumps(unsupported))
        (self.inputs / "03_malformed.json").write_text("{broken")
        self.save_sample("math", "04_math.json")
        (self.inputs / "ignored.txt").write_text("not a response")
        nested = self.inputs / "nested"
        nested.mkdir()
        (nested / "ignored.json").write_text("{broken")
        self.outputs.mkdir()
        old_output = self.outputs / "02_unsupported_generated.json"
        old_output.write_text("previous result")

        report = self.convert()
        self.assertEqual((report["converted"], report["failed"], report["review_required"]), (2, 2, 2))
        self.assertEqual([item["status"] for item in report["files"]], ["converted", "failed", "failed", "converted"])
        self.assertEqual(report["files"][1]["error_type"], "ValueError")
        self.assertIn("UNSUPPORTED HEADING", report["files"][1]["error"])
        self.assertEqual(report["files"][2]["error_type"], "JSONDecodeError")
        self.assertIsNone(report["files"][1]["output"])
        self.assertEqual(old_output.read_text(), "previous result")
        self.assertFalse((self.outputs / "03_malformed_generated.json").exists())
        for prefix, major in [("01", "cs"), ("04", "math")]:
            actual = json.loads((self.outputs / f"{prefix}_{major}_generated.json").read_text())
            expected = json.loads((DATA / f"berkeley_{major}_2026_2027_generated.json").read_text())
            self.assertEqual(actual, expected)
        self.assertTrue(report["files"][0]["review_notes"])
        self.assertEqual(json.loads((self.outputs / "batch_report.json").read_text()), report)

    def test_missing_empty_or_same_input_folder_is_rejected(self):
        for input_folder, output_folder, message in [
            (self.root / "missing", self.outputs, "does not exist"),
            (self.inputs, self.outputs, "No JSON files"),
            (self.inputs, self.inputs, "must be different")
        ]:
            with self.subTest(message=message), self.assertRaisesRegex(ValueError, message):
                convert_folder(input_folder, output_folder)
        self.assertFalse(self.outputs.exists())

    def test_output_write_failure_is_reported_and_next_file_still_converts(self):
        self.save_sample("cs", "a_cs.json")
        self.save_sample("math", "b_math.json")
        (self.outputs / "a_cs_generated.json").mkdir(parents=True)
        report = self.convert()
        self.assertEqual((report["converted"], report["failed"]), (1, 1))
        self.assertEqual(report["files"][0]["error_type"], "IsADirectoryError")
        self.assertTrue((self.outputs / "b_math_generated.json").is_file())

    def test_batch_cli_signals_failure_after_saving_successful_files_and_report(self):
        self.save_sample("cs", "cs.json")
        (self.inputs / "bad.json").write_text("{broken")
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--batch", str(self.inputs), str(self.outputs)],
            cwd=self.root, capture_output=True, text=True
        )
        self.assertEqual(result.returncode, 1, result.stderr)
        report = json.loads((self.outputs / "batch_report.json").read_text())
        self.assertEqual((report["converted"], report["failed"]), (1, 1))
        self.assertTrue((self.outputs / "cs_generated.json").is_file())

    def test_successful_batch_cli_and_existing_single_file_command(self):
        self.save_sample("cs", "cs.json")
        self.save_sample("math", "math.json")
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--batch", str(self.inputs), str(self.outputs)],
            cwd=self.root, capture_output=True, text=True
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads((self.outputs / "batch_report.json").read_text())
        self.assertEqual((report["converted"], report["failed"]), (2, 0))
        single_output = self.root / "single.json"
        result = subprocess.run(
            [sys.executable, str(SCRIPT), str(DATA / "raw/berkeley_cs_2026_2027.json"), str(single_output)],
            cwd=self.root, capture_output=True, text=True
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(single_output.read_text()),
                         json.loads((DATA / "berkeley_cs_2026_2027_generated.json").read_text()))


if __name__ == "__main__":
    unittest.main()
