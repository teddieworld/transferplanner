# Articulation response conversion

The current parser reads an ASSIST JSON response exported from the browser's
Network panel. It converts the Berkeley CS sample into the existing normalized
agreement format. It does not download other agreements or write to PostgreSQL.

Run from the repository root:

```sh
python3 transferplanner/scraper/articulation_parser.py
python3 -m unittest discover -s transferplanner/scraper/tests -v
```

Input: `transferplanner/data/raw/berkeley_cs_2026_2027.json`.

Output: `transferplanner/data/berkeley_cs_2026_2027_generated.json`.

The original manually entered agreement stays unchanged for comparison. The
generated core reproduces its three groups, eight requirements, course options,
statuses, and notes. Nested JSON strings are decoded, entries are sorted by their
positions, and course mappings are joined by `templateCellId`.

This converter currently accepts the demonstrated required/recommended headings,
AND within course options, explicitly linked OR alternatives, and whole-course
section counts. Unrecognized relationships, headings, overrides, and unsupported
structures raise errors for review rather than being flattened into simpler rules.

The generated file additionally retains publication metadata and the complete
general-information assets under `source`. `review_required` flags general text
that may affect the plan. The existing importer does not interpret these extra
fields; do not import generated data until that review is complete.

The Berkeley CS source includes a major-specific linear-algebra exception to the
MATH 54 series and exam-credit instructions. These are preserved but are not yet
encoded as planner rules. The existing database and frontend have not been changed.
