# Articulation response conversion

The current parser reads an ASSIST JSON response exported from the browser's
Network panel. It converts the six saved Berkeley samples into the normalized
agreement format. It does not download other
agreements or write to PostgreSQL.

Run from the repository root:

```sh
python3 transferplanner/scraper/articulation_parser.py transferplanner/data/raw/berkeley_cs_2026_2027.json transferplanner/data/berkeley_cs_2026_2027_generated.json
python3 transferplanner/scraper/articulation_parser.py transferplanner/data/raw/berkeley_math_2026_2027.json transferplanner/data/berkeley_math_2026_2027_generated.json
python3 -m unittest discover -s transferplanner/scraper/tests -v
```

The first argument selects the raw input file; the second selects the output
file. Both are required, and they must refer to different files. The output
directory must already exist. Each command converts one agreement; it stops
before writing if the response contains unsupported rules. Reviewed preparation
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
counts successful conversions, failures, and converted agreements needing review.
A bad response or output-file error is recorded and processing continues with the
next file. The command exits with status 1 if any file failed, or 0 if all converted.
A configuration/input-folder error exits with status 2.

A failed file has no successful output listed in the report. An older output from
a previous run may still exist; use the current report to identify successful
results. Successful conversion preserves source notes for review and does not
mean an agreement is ready to import. Folder mode does not import database rows.

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
or section advisements are rejected because they need a nested model.
Unrecognized relationships, headings, overrides, and unsupported
structures raise errors for review rather than being flattened into simpler rules.

`SectionHeader` items are preserved under `source.section_headers` for review.
Recognized headings such as `REQUIRED FOR ADMISSION` set the category for following
sections within their group, overriding a broader degree-requirement heading.
They do not create requirement groups;
the actual `Section` items beneath them are still processed. Unknown section
types and headers carrying attributes or completion rules are rejected.

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
