"""Capture public ASSIST major agreements through normal browser navigation."""
import argparse
import json
import re
import os
import tempfile
from pathlib import Path
from urllib.parse import parse_qs, urlparse, urlencode


RAW_FOLDER = Path(__file__).resolve().parents[1] / "data/raw"


class RateLimitError(RuntimeError):
    def __init__(self, retry_after=60):
        super().__init__("ASSIST returned HTTP 429; pause before resuming collection")
        self.retry_after = retry_after


def agreement_key(url):
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ("assist.org", "www.assist.org"):
        raise ValueError("Use an https://assist.org agreement-page URL")
    if parsed.path.rstrip("/") != "/transfer/results":
        raise ValueError("Use the agreement page URL from ASSIST's transfer results")
    keys = parse_qs(parsed.query).get("viewByKey", [])
    if len(keys) != 1:
        raise ValueError("Agreement URL must contain one viewByKey")
    parts = keys[0].split("/")
    if (len(parts) != 6 or parts[2] != "to" or parts[4] != "Major" or
            any(not part.isdigit() for part in (parts[0], parts[1], parts[3])) or
            not re.fullmatch(r"[0-9a-fA-F-]{36}", parts[5])):
        raise ValueError("This collector supports sending-college-to-university major URLs")
    return keys[0]


def major_list_scope(url):
    """Accept a major page or a results list without needing a major UUID."""
    parsed = urlparse(url)
    if (parsed.scheme != "https" or parsed.hostname not in ("assist.org", "www.assist.org") or
            parsed.path.rstrip("/") != "/transfer/results"):
        raise ValueError("Use an https://assist.org/transfer/results URL")
    query = parse_qs(parsed.query)
    if "viewByKey" in query:
        return "/".join(agreement_key(url).split("/")[:5])
    values = {}
    for name in ("year", "institution", "agreement"):
        items = query.get(name, [])
        if len(items) != 1 or not items[0].isdigit():
            raise ValueError(f"Results URL must contain one numeric {name}")
        values[name] = items[0]
    if query.get("agreementType") != ["to"] or query.get("viewBy") != ["major"]:
        raise ValueError("Choose sending-college-to-university major agreements")
    return f"{values['year']}/{values['institution']}/to/{values['agreement']}/Major"


def matches_agreement_response(url, expected_key):
    parsed = urlparse(url)
    return (parsed.scheme == "https" and parsed.hostname in ("assist.org", "www.assist.org") and
            parsed.path.lower().rstrip("/") == "/api/articulation/agreements" and
            parse_qs(parsed.query).get("Key", []) == [expected_key])


def agreement_url(key):
    if not isinstance(key, str):
        raise ValueError("Agreement key must be text")
    agreement_key("https://assist.org/transfer/results?" + urlencode({"viewByKey": key}))
    parts = key.split("/")
    url = "https://assist.org/transfer/results?" + urlencode({
        "year": parts[0], "institution": parts[1], "agreement": parts[3],
        "agreementType": "to", "viewAgreementsOptions": "true", "view": "agreement",
        "viewBy": "major", "viewSendingAgreements": "false", "viewByKey": key
    })
    agreement_key(url)
    return url


def matches_major_list(url, key):
    parsed = urlparse(url)
    parts = key.split("/")
    query = parse_qs(parsed.query)
    return (parsed.scheme == "https" and parsed.hostname in ("assist.org", "www.assist.org") and
            parsed.path.lower().rstrip("/") == "/api/agreements" and
            all(query.get(name) == [value] for name, value in {
                "academicYearId": parts[0], "sendingInstitutionId": parts[1],
                "receivingInstitutionId": parts[3], "categoryCode": "major"
            }.items()))


def parse_major_list(payload, key):
    reports = payload.get("reports") if isinstance(payload, dict) else None
    if not isinstance(reports, list) or not reports:
        raise ValueError("ASSIST did not return a nonempty major-agreement list")
    scope = key.split("/")[:5]
    majors = {}
    for item in reports:
        if not isinstance(item, dict) or not isinstance(item.get("label"), str) or not item["label"].strip():
            raise ValueError("Major list contains an unnamed entry")
        candidate = item.get("key", "")
        agreement_key(agreement_url(candidate))
        if candidate.split("/")[:5] != scope or str(item.get("ownerInstitutionId")) != scope[3]:
            raise ValueError("Major list contains an agreement for another year or institution")
        if candidate in majors and majors[candidate]["label"] != item["label"]:
            raise ValueError("Major list contains conflicting labels for one agreement")
        majors[candidate] = {"label": item["label"], "key": candidate}
    return sorted(majors.values(), key=lambda item: (item["label"].casefold(), item["key"]))


def write_json(path, payload, overwrite=True):
    """Publish complete JSON atomically; exclusive creation protects old captures."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                         prefix=".capture-", suffix=".tmp", delete=False) as file:
            temporary = Path(file.name)
            json.dump(payload, file, indent=2, ensure_ascii=False)
            file.write("\n")
        if overwrite:
            temporary.replace(path)
        else:
            os.link(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def validate_response(response, key):
    if not isinstance(response, dict) or response.get("isSuccessful") is not True:
        raise ValueError("ASSIST did not return a successful agreement response")
    result = response.get("result")
    if not isinstance(result, dict) or result.get("type") != "Major" or not result.get("name"):
        raise ValueError("Response does not contain a named major agreement")
    year, sending, _, receiving, _, _ = key.split("/")
    for field, expected in [("academicYear", year), ("sendingInstitution", sending), ("receivingInstitution", receiving)]:
        if str(json.loads(result[field])["id"]) != expected:
            raise ValueError(f"Response {field} does not match the requested agreement")
    # Preserve the exported response format consumed by articulation_parser.py.
    if not isinstance(json.loads(result["templateAssets"]), list) or not isinstance(json.loads(result["articulations"]), list):
        raise ValueError("Response has invalid template assets or articulations")
    return result


def save_response(response, key, output_folder=RAW_FOLDER, overwrite=False, existing_path=None):
    result = validate_response(response, key)
    parts = key.split("/")
    major = re.sub(r"[^a-z0-9]+", "_", result["name"].lower()).strip("_")
    year = json.loads(result["academicYear"])["code"]
    if not major or not re.fullmatch(r"\d{4}[-–]\d{4}", year):
        raise ValueError("Major name or academic year cannot form a filename")
    filename = f"{parts[1]}_to_{parts[3]}_{major}_{year.replace('–', '_').replace('-', '_')}.json"
    output = Path(output_folder) / filename
    if existing_path is not None:
        if not overwrite or Path(existing_path).parent.resolve() != Path(output_folder).resolve():
            raise ValueError("Existing capture must be inside the output folder and explicitly replaceable")
        output = Path(existing_path)
    write_json(output, response, overwrite)
    return output


def capture_on_page(page, url, key, timeout_ms):
    from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
    try:
        with page.expect_response(lambda response: matches_agreement_response(response.url, key),
                                  timeout=timeout_ms) as captured:
            page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
        response = captured.value
    except PlaywrightTimeoutError as error:
        raise RuntimeError("ASSIST did not load the matching agreement before the timeout. Try --headed to inspect the page.") from error
    if not response.ok:
        if response.status == 429:
            retry_after = response.headers.get("retry-after", "60")
            raise RateLimitError(int(retry_after) if retry_after.isdigit() else 60)
        raise RuntimeError(f"ASSIST returned HTTP {response.status} for the agreement; no response was saved")
    return response.json()


def collect_agreement(url, output_folder=RAW_FOLDER, headed=False, timeout_ms=45000, overwrite=False):
    key = agreement_key(url)
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=not headed)
        try:
            page = browser.new_page()
            return save_response(capture_on_page(page, url, key, timeout_ms), key, output_folder, overwrite)
        finally:
            browser.close()


def existing_captures(output_folder, majors):
    keys_by_name = {major["label"]: major["key"] for major in majors}
    existing, warnings = {}, []
    for path in sorted(Path(output_folder).glob("*.json")):
        if not path.is_file():
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            name = payload.get("result", {}).get("name")
            if name not in keys_by_name:
                continue
            key = keys_by_name[name]
            validate_response(payload, key)
            existing.setdefault(key, path)
        except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
            warnings.append({"file": str(path), "error": str(error)})
    return existing, warnings


def capture_major_batch(page, majors, output_folder, timeout_ms=45000, overwrite=False, delay_ms=1000,
                        limit=None, report_path=None):
    existing, warnings = existing_captures(output_folder, majors)
    selected = majors if limit is None else majors[:limit]
    report = {"available": len(majors), "selected": len(selected), "saved": 0, "skipped": 0,
              "failed": 0, "existing_file_warnings": warnings, "files": []}
    if report_path is not None:
        write_json(report_path, report)
    for index, major in enumerate(selected, start=1):
        key, label = major["key"], major["label"]
        entry = {"major": label, "key": key, "url": agreement_url(key)}
        if key in existing and not overwrite:
            report["skipped"] += 1
            entry.update(status="skipped", output=str(existing[key]))
        else:
            try:
                try:
                    payload = capture_on_page(page, entry["url"], key, timeout_ms)
                except RateLimitError as error:
                    print(f"ASSIST rate limit: waiting {max(60, error.retry_after)} seconds before one retry.", flush=True)
                    page.wait_for_timeout(max(60, error.retry_after) * 1000)
                    payload = capture_on_page(page, entry["url"], key, timeout_ms)
                if payload.get("result", {}).get("name") != label:
                    raise ValueError("Response major name does not match the discovered list entry")
                output = save_response(payload, key, output_folder, overwrite, existing.get(key))
                report["saved"] += 1
                entry.update(status="saved", output=str(output))
            except Exception as error:
                report["failed"] += 1
                entry.update(status="failed", output=None, error_type=type(error).__name__, error=str(error))
        report["files"].append(entry)
        if report_path is not None:
            write_json(report_path, report)
        print(f"[{index}/{len(selected)}] {entry['status']}: {label}", flush=True)
        if entry.get("error_type") == "RateLimitError":
            report["not_attempted"] = len(selected) - index
            if report_path is not None:
                write_json(report_path, report)
            print("Rate limit persists; collection stopped. Rerun later to resume saved progress.", flush=True)
            break
        if entry["status"] != "skipped" and delay_ms > 0 and index < len(selected):
            page.wait_for_timeout(delay_ms)
    return report


def collect_all_majors(url, output_folder=RAW_FOLDER, headed=False, timeout_ms=45000, overwrite=False,
                       limit=None, delay_ms=1000):
    key = major_list_scope(url)
    from playwright.sync_api import sync_playwright
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=not headed)
        try:
            page = browser.new_page()
            with page.expect_response(lambda response: matches_major_list(response.url, key), timeout=timeout_ms) as captured:
                page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
            response = captured.value
            if not response.ok:
                raise RuntimeError(f"ASSIST returned HTTP {response.status} for the major list")
            majors = parse_major_list(response.json(), key)
            parts = key.split("/")
            report_path = Path(output_folder) / "_collection" / f"report_{parts[0]}_{parts[1]}_to_{parts[3]}.json"
            print(f"Discovered {len(majors)} major agreements for this year and institution pair.", flush=True)
            report = capture_major_batch(page, majors, output_folder, timeout_ms, overwrite, delay_ms, limit, report_path)
            print(f"Saved: {report['saved']}; skipped: {report['skipped']}; failed: {report['failed']}. Report: {report_path}")
            return report
        finally:
            browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Capture public ASSIST major agreements and automatically name their raw JSON files.")
    parser.add_argument("url", help="Public ASSIST agreement URL, or results-list URL with --all-majors")
    parser.add_argument("--output-dir", type=Path, default=RAW_FOLDER)
    parser.add_argument("--headed", action="store_true", help="Show the browser during capture")
    parser.add_argument("--timeout", type=int, default=45, help="Navigation/response timeout in seconds")
    parser.add_argument("--overwrite", action="store_true", help="Replace an existing capture with the same filename")
    parser.add_argument("--all-majors", action="store_true", help="Discover and capture all majors for the URL's year and institution pair")
    parser.add_argument("--limit", type=int, help="Process only the first N alphabetically sorted majors (bulk mode)")
    parser.add_argument("--delay", type=float, default=1, help="Seconds between bulk captures (minimum 1)")
    args = parser.parse_args()
    if args.timeout < 1:
        parser.error("Timeout must be at least one second")
    if args.limit is not None and (args.limit < 1 or not args.all_majors):
        parser.error("Use --limit with --all-majors and a positive count")
    if args.delay < 1:
        parser.error("Delay must be at least one second")
    try:
        if args.all_majors:
            report = collect_all_majors(args.url, args.output_dir, args.headed, args.timeout * 1000,
                                        args.overwrite, args.limit, int(args.delay * 1000))
            raise SystemExit(1 if report["failed"] else 0)
        output = collect_agreement(args.url, args.output_dir, args.headed, args.timeout * 1000, args.overwrite)
    except Exception as error:
        parser.exit(1, f"Capture failed: {type(error).__name__}: {error}\n")
    print(f"Saved raw agreement: {output}")
