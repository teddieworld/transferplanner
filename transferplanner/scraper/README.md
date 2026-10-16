# Articulation response conversion

The parser reads ASSIST JSON responses captured from the browser and converts
them into the planner's agreement format. All 95 saved Mt. SAC → Berkeley
2026–2027 agreements now generate files. Conversion does not download data or
write to PostgreSQL; source notes and unresolved completion rules require review.

## Capture an agreement automatically

`assist_collector.py` opens a public major-agreement URL in Chromium, waits for
its matching articulation response, validates the response, and saves its raw
JSON automatically. Install the browser support once from the project root:

```sh
.venv/bin/python -m pip install playwright
.venv/bin/python -m playwright install chromium
```

Run the collector with the full agreement-page URL copied from ASSIST:

```sh
.venv/bin/python transferplanner/scraper/assist_collector.py "PASTE_THE_FULL_ASSIST_AGREEMENT_URL_HERE"
```

The quoted URL must contain `viewByKey`. The collector supports `to`/`Major`
agreements and captures one agreement by default. It listens to the browser's
normal request; it does not modify requests or use the separate key-based API.
Filenames are generated from the sending/receiving institution IDs, major, and
academic year, for example `62_to_79_computer_science_b_a_2026_2027.json`.
The default destination is `transferplanner/data/raw/`, resolved relative to the
script. `--output-dir` changes the destination. Existing files are protected;
`--overwrite` explicitly allows replacing a capture. `--headed` shows the browser,
and `--timeout 60` increases the navigation/response timeout to 60 seconds.

Live capture of the supplied Berkeley CS 2026–2027 page has been verified. The
captured file also passes through the converter. The collector saves raw data; conversion,
review, and database importing remain separate steps. Capture errors exit with
status 1 and are printed in the terminal.

### Collect multiple majors

Supply any one agreement URL for the desired college, university, and academic
year. `--all-majors` listens for the major list loaded by that page, validates the
list's scope, and navigates to each major's agreement sequentially. A small test:

```sh
.venv/bin/python transferplanner/scraper/assist_collector.py --all-majors --limit 5 "PASTE_THE_FULL_ASSIST_AGREEMENT_URL_HERE"
```

Remove `--limit 5` to process the complete discovered list. The limit selects the
first N majors alphabetically, including already saved files. Valid matching raw
responses in the output folder are skipped, even when they use older manually
chosen filenames. Rerunning the command resumes from files already saved. Only
the selected year's sending/receiving institution pair is collected.

Requests use one browser page, with a one-second pause between capture attempts.
`--delay 2` increases the pause. Errors are recorded and processing continues;
the process exits with status 1 if a selected agreement failed. `--overwrite`
refreshes existing matching captures in their original filenames; without it,
existing raw files are preserved. Captures and reports are written atomically.

The collector writes a checkpoint after each result to
`<output-folder>/_collection/report_<year-id>_<sending-id>_to_<receiving-id>.json`.
It includes available/selected counts, saved/skipped/failed totals, per-major
URLs and filenames, and warnings for existing files that could not be validated.
Reports are inside a subfolder so batch conversion does not mistake them for
agreement responses.

Live discovery found 95 Mt. SAC → Berkeley major agreements for academic-year ID
77 (2026–2027). A three-major browser test saved two responses and skipped an
existing capture with zero failures. The subsequent full collection saved 88
responses and skipped seven valid existing captures; all 95 are present in the
raw folder.

Run from the repository root:

```sh
python3 transferplanner/scraper/articulation_parser.py transferplanner/data/raw/berkeley_cs_2026_2027.json transferplanner/data/berkeley_cs_2026_2027_generated.json
python3 transferplanner/scraper/articulation_parser.py transferplanner/data/raw/berkeley_math_2026_2027.json transferplanner/data/berkeley_math_2026_2027_generated.json
python3 -m unittest discover -s transferplanner/scraper/tests -v
```

The first argument selects the raw input file; the second selects the output
file. Both are required, and they must refer to different files. The output
directory must already exist. Each command converts one agreement; it stops
before writing if the response contains unreviewed unsupported rules. Reviewed preparation
rules are loaded relative to the script, independently of the working directory.

## Folder conversion

Process all `.json` files directly inside the raw folder:

```sh
python3 transferplanner/scraper/articulation_parser.py --batch transferplanner/data/raw transferplanner/data/generated
```

Folder mode creates the output directory and saves each agreement as
`<input_filename_without_extension>_generated.json`. Subfolders are not searched.
The input and output folders must be different. A missing or empty input folder
is an error.

`batch_report.json` in the output folder records each input file, its conversion
status, output path, and either review notes or an error type/message. It also
counts successful conversions, failures, converted agreements needing review,
and agreements with groups blocked from automatic completion
(`calculation_review_required`).
A bad response or output-file error is recorded and processing continues with the
next file. The command exits with status 1 if any file failed, or 0 if all converted.
A configuration/input-folder error exits with status 2.

A failed file has no successful output listed in the report. An older output from
a previous run may still exist; use the current report to identify successful
results. Successful conversion preserves source notes for review and does not
mean an agreement is ready to import. Folder mode does not import database rows.

The collected 95-agreement Berkeley 2026–2027 dataset converts **95 agreements
with zero failures**. All 95 preserve guidance requiring review. **31 agreements
contain at least one group whose completion cannot be evaluated automatically**;
this includes American Studies' existing introductory-course ambiguity. These
groups have `review_required: true` and cannot be marked satisfied even when
every listed course is checked. Unresolved individual mappings use the distinct
`articulation_status: "review_required"`, rather than claiming there is no
articulation. The Python and frontend planners retain this distinction.

`data/reviewed_agreement_profiles.json` binds additional headings, untitled
admission groups, sequence alternatives, and review-group handling to the exact
major, institution IDs, academic year, publication, and SHA-256 digests of the
template and mapping data. Changed source content requires another review.
Ambiguous concentration choices, area constraints, unit totals, program variants,
and inconsistencies remain non-evaluable; they are not converted into complete-all
requirements. Their full native templates and mappings are retained under
`source.native_requirements` and `source.native_articulations`.

Cognitive Science's
`REQUIRED COURSES` title is classified as admission preparation using
`data/reviewed_heading_rules.json`: the rule checks the major, institution IDs,
academic year, publication timestamp, and exact instruction in the source text.
This does not make the same ambiguous heading valid for other agreements.

Complete-all advisements (`CompleteFollowing`, `CompleteAllCourses`), integral
course/row/course-combination counts, and course selections are supported.
Unit totals are not treated as course counts. Known informational notes on
headers, sections, and groups are retained. An explicit `No Course Articulated`
or `This Course is Never Articulated` without sending options remains unmapped;
an explicit university-only reason remains a separate status.

`reviewed_templates.py` compiles the specifically reviewed calculus/physics
sequence alternatives and compound OR sections into complete sending-course
combinations. For example, Economics requires a full MATH 51/52 or 16A/16B
sequence, not one calculus course. Political Science's additional requirement
retains POL SCI 3 **or both** DATA C8 and POL SCI 88. Original transformed
structures are retained under `source.reviewed_template_transformations`.
The Data Science MATH 54 preparation exception is separately scoped in
`reviewed_preparation_rules.json`; it does not change full equivalence or the
Mathematics major's rules.

For future sources outside the reviewed profiles, `--batch --include-review`
optionally saves semantic conversion failures as distinct `kind: "review_required"`
packages in `<output>/_review/`. They retain the complete original agreement and
a readable requirement tree. The report lists them as `blocked`, not converted,
and the CLI still exits with status 1. The importer rejects these packages before
issuing SQL. Malformed responses and I/O failures remain failures.

All 95 generated outputs have been tested through an isolated PostgreSQL schema,
with every test change rolled back. Their referenced courses exist in the saved
Mt. SAC catalog. This verification does not import them into the live planner.

The original manually entered agreement stays unchanged for comparison. The
generated core reproduces its three groups, eight requirements, course options,
statuses, and notes. The MATH 54 requirement additionally receives separate
`preparation_options` and `preparation_note` from an explicitly reviewed rule.
Nested JSON strings are decoded, entries are sorted by their
positions, and course mappings are joined by `templateCellId`.

This converter currently accepts the demonstrated required/recommended headings,
AND within course options, OR within a sending-course group (expanded into separate
alternatives), explicitly linked OR course alternatives, and whole-course
section counts. It also accepts complete-all `Following` groups and single sections
without a group instruction. OR between sections containing one course each becomes
one normalized group with `required_count: 1`; alternatives containing several rows
or section advisements need a publication-bound transformation or a non-evaluable
review group. Unknown sources still raise errors rather than being flattened.

`SectionHeader` items are preserved under `source.section_headers` for review.
Recognized headings such as `REQUIRED FOR ADMISSION` set the category for following
sections within their group, overriding a broader degree-requirement heading.
They do not create requirement groups;
the actual `Section` items beneath them are still processed. Unknown section
types and unreviewed headers carrying additional completion rules are rejected.

Named `Requirement` cells use their source names, including Reading & Composition
A/B. Receiving `Series` cells must contain courses joined by AND. A series becomes
one requirement named with `AND` between its course codes; it counts as one choice
in a choose-one group. Its sending-course options determine whether the whole
series is satisfied. OR or empty receiving series are rejected for review.

Aerospace converts to six groups and 23 requirements (17 required, six recommended).
Reading & Composition alternatives remain separate single-course options; science
series preserve complete-course combinations. The cross-listed name CIV ENG C30
is preserved as an alias for MEC ENG C85 in
`source.receiving_cross_listed_courses`, without adding a requirement. Grade,
deadline, and cross-college rules in the general text remain preserved for review
and are not evaluated by the current completed-course checklist. No CS preparation
exception is applied to Aerospace.

Mathematics has three groups: all of MATH 51/52/53, one of MATH 54/56, and
recommended MATH 55. MATH 56 has no sending-course mapping in this response.
The CS preparation exception does not apply: Mathematics MATH 54 still needs
ENGR 285, MATH 285, or both MATH 260 and MATH 290.

The generated file additionally retains publication metadata and the complete
general-information assets under `source`. Receiving-course attributes are also
preserved under `source.receiving_course_attributes`. `review_required` flags these
notes and general text that may affect the plan. The importer stores readable
guidance for display; it does not automatically infer rules from that prose.
Review generated data before importing it.

`LOWER DIVISION MAJOR REQUIREMENTS` creates `major_required` groups, separate
from admission requirements. The African American Studies subsection is explicitly
required for admission and retains that category. American Studies preserves two
degree groups, section notes, and the alternate wrapped cross-list format.
`reviewed_group_rules.json` records publication- and course-list-specific rules
for American Studies: its choose-three group permits no more than two counted
courses per receiving department, while its ambiguous introductory group requires
adviser review. Unknown section instructions are still rejected.

A response containing only General assets and no course mappings is explicitly
`kind: "informational"`, with empty groups and requirements. This applies to the
Ancient Greek and Roman Civilizations response. Its detailed prose stays intact;
no course equivalences are inferred from descriptions or departmental-review
possibilities. The database and website retain its guidance and do not calculate
a completion status for it.

After reviewing the notes, import an agreement from the repository root:

```sh
.venv/bin/python transferplanner/database/import_courses.py transferplanner/data/berkeley_math_2026_2027_generated.json
```

The file path selects the agreement. This uses the existing catalog and commits
the agreement in one transaction; missing courses stop that file's import. Supply
`--courses transferplanner/data/mtsac_courses.json` only when catalog importing
is also needed. The six samples have been checked against their supplied responses;
American Studies' introductory interpretation remains flagged for adviser review.
General education and exam credit remain outside the
planner's course-completion calculations.

To import multiple reviewed results, pass their paths together:

```sh
.venv/bin/python transferplanner/database/import_courses.py \
  transferplanner/data/generated/berkeley_cs_2026_2027_generated.json \
  transferplanner/data/generated/berkeley_math_2026_2027_generated.json \
  transferplanner/data/generated/berkeley_aeroeng_2026_2027_generated.json
```

The importer accepts one or more agreement files. Each file has its own database
connection and transaction: a failure rolls back that file and processing continues.
The terminal lists successes and errors, then prints an import summary. The command
exits with status 1 if any file failed, or 0 if all imports succeeded. Previously
successful imports remain committed when a later file fails. Passing the same
unchanged agreement again reuses its rows instead of creating duplicates.
Pass normalized agreement files, excluding the converter's `batch_report.json`.
This command uses the existing course catalog; `--courses` remains optional and,
when supplied, runs catalog importing within each agreement's transaction.

`transferplanner/data/reviewed_preparation_rules.json` records the approved CS
linear-algebra exception. Applying it requires the same university, major,
college, year, publication date, original options, and source instruction.
A changed publication or instruction raises an error for another review.

Preparation options affect major/group preparation results; the original
`options` still determine full course equivalence. Exam-credit instructions and
other general notes remain preserved for review and are not automatically
interpreted.

## UCLA and UC San Diego

The Mt. SAC dataset now also includes the following ASSIST major/program reports,
checked on October 15, 2026:

| Campus | Agreement year | Agreements | Agreements containing non-evaluable groups |
| --- | --- | ---: | ---: |
| UCLA | 2025–2026 | 134 | 46 |
| UC San Diego | 2026–2027 | 158 | 127 |

[UCLA's 2026–2027 results](https://assist.org/transfer/results?year=77&institution=62&agreement=117&agreementType=to&viewBy=major)
were empty, so its published 2025–2026 agreements are retained under their actual
year. Seven UCSD reports explicitly named as minors are excluded from the major
planner. The existing 95 Berkeley agreements are unchanged.

Captures live in `data/raw/ucla` and `data/raw/ucsd`; normalized agreements and
conversion reports live in the corresponding `data/generated` subfolders.
The collector can start from a results-list URL, without a particular major's
`viewByKey`. From the repository root:

```sh
.venv/bin/python transferplanner/scraper/assist_collector.py --all-majors --delay 4 --output-dir transferplanner/data/raw/ucla "https://assist.org/transfer/results?year=76&institution=62&agreement=117&agreementType=to&view=agreement&viewBy=major&viewSendingAgreements=false"
.venv/bin/python transferplanner/scraper/assist_collector.py --all-majors --delay 4 --output-dir transferplanner/data/raw/ucsd "https://assist.org/transfer/results?year=77&institution=62&agreement=7&agreementType=to&view=agreement&viewBy=major&viewSendingAgreements=false"
```

Existing validated files are skipped. HTTP 429 pauses collection for at least
60 seconds (or the server's longer numeric Retry-After), then retries once. A
second rate limit stops the batch; rerun later to resume.

Convert each campus separately, since batch conversion reads one folder:

```sh
.venv/bin/python transferplanner/scraper/articulation_parser.py --batch --exclude-minors --include-review transferplanner/data/raw/ucla transferplanner/data/generated/ucla
.venv/bin/python transferplanner/scraper/articulation_parser.py --batch --exclude-minors --include-review transferplanner/data/raw/ucsd transferplanner/data/generated/ucsd
```

Review `batch_report.json` and import only files listed as `converted` in that
run. Old generated files can remain after a failed or skipped conversion. These
snapshots converted with zero failures and zero blocked major agreements.

The converter supports counted AND/OR sections and AND combinations of sending
course alternatives. Source-bound profiles classify campus headings and retain
unmodeled sequence, area, language-placement and other conditions for review.
Flagged groups cannot be calculated as complete. Their original requirements
and mappings remain in the generated JSON. Changed publications or source hashes
require another profile review; do not copy Berkeley-specific exceptions to
another campus.

`data/mtsac_agreement_course_supplement.json` adds 18 missing course codes without
renaming them into current courses. Titles and units come from the captured
agreements; UC transferability comes from the saved ASSIST eligibility snapshot,
or [Mt. SAC's computer science course descriptions](https://www.mtsac.edu/math/all_cs_descriptions.html)
for CSCI 220. Per-course source references are retained. CSU transferability is
not inferred from a UC approval. Supply this supplemental catalog with `--courses`
when importing these agreements into another database.

The importer uses `DATABASE_URL` when explicitly set in the terminal environment;
otherwise it keeps the local `transferplanner` database default. It does not load
the app's dotenv files automatically. The local and production databases contain
all 292 added agreements and 1,688 catalog courses. Imports were checked on an
isolated Neon branch first, with existing rows preserved and foreign keys checked.

The website's campus selectors and agreement-year dropdowns read these records
automatically. Reviewed UCLA and UCSD AP-to-major policies are implemented in
`frontend/lib/ucla-ap-major-policies.ts` and `frontend/lib/ucsd-ap-major-policies.ts`.
See `frontend/data/AP_MAJOR_POLICIES.md` for policy scope, sources and conditions.
