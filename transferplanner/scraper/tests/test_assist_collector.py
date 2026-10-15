import copy
import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from urllib.parse import urlencode
from unittest.mock import Mock, patch

from transferplanner.scraper.assist_collector import (
    agreement_key, agreement_url, matches_agreement_response, matches_major_list,
    parse_major_list, save_response, capture_major_batch
)


KEY = "77/62/to/79/Major/a0def9ce-6e18-40c4-3f64-08dec89fcc4a"
URL = "https://assist.org/transfer/results?" + urlencode({"viewByKey": KEY})
DATA = Path(__file__).resolve().parents[2] / "data"


class AssistCollectorTests(unittest.TestCase):
    def setUp(self):
        self.response = json.loads((DATA / "raw/berkeley_cs_2026_2027.json").read_text())
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.output = Path(directory.name) / "raw"

    def test_url_and_response_filter_match_only_the_requested_agreement(self):
        self.assertEqual(agreement_key(URL), KEY)
        api = "https://assist.org/api/articulation/Agreements?" + urlencode({"Key": KEY})
        self.assertTrue(matches_agreement_response(api, KEY))
        for url in [api.replace("assist.org", "example.com"), api.replace("Agreements", "Other"),
                    api.replace("77%2F62", "76%2F62")]:
            self.assertFalse(matches_agreement_response(url, KEY))
        for url in ["https://example.com/transfer/results?" + urlencode({"viewByKey": KEY}),
                    "https://assist.org/transfer/results", URL.replace("/transfer/results", "/")]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                agreement_key(url)

    def test_capture_filename_uses_actual_major_year_and_institutions(self):
        saved = save_response(self.response, KEY, self.output)
        self.assertEqual(saved.name, "62_to_79_computer_science_b_a_2026_2027.json")
        self.assertEqual(json.loads(saved.read_text()), self.response)

    def test_unsuccessful_or_mismatched_responses_are_not_saved(self):
        cases = []
        unsuccessful = copy.deepcopy(self.response)
        unsuccessful["isSuccessful"] = False
        cases.append(unsuccessful)
        for field in ["academicYear", "sendingInstitution", "receivingInstitution"]:
            altered = copy.deepcopy(self.response)
            metadata = json.loads(altered["result"][field])
            metadata["id"] = 999
            altered["result"][field] = json.dumps(metadata)
            cases.append(altered)
        wrong_assets = copy.deepcopy(self.response)
        wrong_assets["result"]["templateAssets"] = "null"
        cases.append(wrong_assets)
        for response in cases:
            with self.assertRaises(ValueError):
                save_response(response, KEY, self.output)
        self.assertFalse(self.output.exists())

    def test_existing_capture_is_protected_unless_overwrite_is_explicit(self):
        saved = save_response(self.response, KEY, self.output)
        original = saved.read_bytes()
        updated = copy.deepcopy(self.response)
        updated["result"]["publishDate"] = "2030-01-01"
        with self.assertRaises(FileExistsError):
            save_response(updated, KEY, self.output)
        self.assertEqual(saved.read_bytes(), original)
        self.assertEqual(save_response(updated, KEY, self.output, overwrite=True), saved)
        self.assertEqual(json.loads(saved.read_text()), updated)

    def test_external_names_cannot_escape_the_output_folder(self):
        response = copy.deepcopy(self.response)
        response["result"]["name"] = "../../Other/Major"
        saved = save_response(response, KEY, self.output)
        self.assertEqual(saved.parent.resolve(), self.output.resolve())
        self.assertNotIn("..", saved.name)
        invalid_year = copy.deepcopy(self.response)
        metadata = json.loads(invalid_year["result"]["academicYear"])
        metadata["code"] = "../../outside"
        invalid_year["result"]["academicYear"] = json.dumps(metadata)
        with self.assertRaises(ValueError):
            save_response(invalid_year, KEY, self.output)

    def test_major_discovery_checks_scope_sorts_and_ignores_all_majors_report(self):
        second = KEY.replace("a0def9ce", "b0def9ce")
        payload = {"reports": [
            {"label": "Zoology", "key": KEY, "ownerInstitutionId": 79},
            {"label": "Art", "key": second, "ownerInstitutionId": 79}
        ], "allReports": [{"label": "All Majors", "key": "77/62/to/79/AllMajors"}]}
        self.assertEqual([m["label"] for m in parse_major_list(payload, KEY)], ["Art", "Zoology"])
        self.assertEqual(agreement_key(agreement_url(second)), second)
        list_url = "https://assist.org/api/agreements?" + urlencode({
            "academicYearId": 77, "sendingInstitutionId": 62, "receivingInstitutionId": 79, "categoryCode": "major"
        })
        self.assertTrue(matches_major_list(list_url, KEY))
        self.assertFalse(matches_major_list(list_url.replace("academicYearId=77", "academicYearId=76"), KEY))
        for changed in ["76/62/to/79/Major/" + KEY.split("/")[-1], "bad-key"]:
            altered = copy.deepcopy(payload)
            altered["reports"][0]["key"] = changed
            with self.assertRaises(ValueError):
                parse_major_list(altered, KEY)

    def test_batch_skips_legacy_capture_records_failure_and_saves_next_major(self):
        self.output.mkdir()
        legacy = self.output / "berkeley_cs_2026_2027.json"
        legacy.write_text(json.dumps(self.response))
        original = legacy.read_bytes()
        math = json.loads((DATA / "raw/berkeley_math_2026_2027.json").read_text())
        majors = [
            {"label": self.response["result"]["name"], "key": KEY},
            {"label": "Unavailable major", "key": KEY.replace("a0def9ce", "b0def9ce")},
            {"label": math["result"]["name"], "key": KEY.replace("a0def9ce", "c0def9ce")}
        ]
        report_path = self.output / "_collection/report.json"
        with patch("transferplanner.scraper.assist_collector.capture_on_page", side_effect=[RuntimeError("HTTP 500"), math]) as capture:
            with contextlib.redirect_stdout(io.StringIO()):
                report = capture_major_batch(Mock(), majors, self.output, delay_ms=0, report_path=report_path)
        self.assertEqual(capture.call_count, 2)
        self.assertEqual((report["saved"], report["skipped"], report["failed"]), (1, 1, 1))
        self.assertEqual([f["status"] for f in report["files"]], ["skipped", "failed", "saved"])
        self.assertEqual(legacy.read_bytes(), original)
        self.assertEqual(json.loads(report_path.read_text()), report)
        with patch("transferplanner.scraper.assist_collector.capture_on_page") as capture:
            with contextlib.redirect_stdout(io.StringIO()):
                resumed = capture_major_batch(Mock(), [majors[0], majors[2]], self.output, delay_ms=0)
        capture.assert_not_called()
        self.assertEqual(resumed["skipped"], 2)

    def test_bulk_overwrite_refreshes_legacy_filename_without_duplicate(self):
        self.output.mkdir()
        legacy = self.output / "berkeley_cs_2026_2027.json"
        legacy.write_text(json.dumps(self.response))
        updated = copy.deepcopy(self.response)
        updated["result"]["publishDate"] = "2030-01-01"
        majors = [{"label": updated["result"]["name"], "key": KEY}]
        with patch("transferplanner.scraper.assist_collector.capture_on_page", return_value=updated):
            with contextlib.redirect_stdout(io.StringIO()):
                report = capture_major_batch(Mock(), majors, self.output, overwrite=True, delay_ms=0)
        self.assertEqual(report["saved"], 1)
        self.assertEqual(json.loads(legacy.read_text()), updated)
        self.assertEqual(list(self.output.glob("*.json")), [legacy])

    def test_limit_and_mismatched_major_name_do_not_create_wrong_capture(self):
        majors = [{"label": "Wrong major", "key": KEY},
                  {"label": "Not selected", "key": KEY.replace("a0def9ce", "b0def9ce")}]
        with patch("transferplanner.scraper.assist_collector.capture_on_page", return_value=self.response) as capture:
            with contextlib.redirect_stdout(io.StringIO()):
                report = capture_major_batch(Mock(), majors, self.output, limit=1, delay_ms=0)
        self.assertEqual(capture.call_count, 1)
        self.assertEqual((report["available"], report["selected"], report["failed"]), (2, 1, 1))
        self.assertFalse(self.output.exists())

    def test_atomic_capture_failure_leaves_old_file_and_no_temporary_files(self):
        saved = save_response(self.response, KEY, self.output)
        original = saved.read_bytes()
        with patch("transferplanner.scraper.assist_collector.json.dump", side_effect=OSError("disk full")):
            with self.assertRaises(OSError):
                save_response(self.response, KEY, self.output, overwrite=True)
        self.assertEqual(saved.read_bytes(), original)
        self.assertEqual(list(self.output.glob(".capture-*")), [])


if __name__ == "__main__":
    unittest.main()
