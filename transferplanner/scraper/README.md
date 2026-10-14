# Articulation response conversion

The current parser reads an ASSIST JSON response exported from the browser's
Network panel. It converts the Berkeley CS and Mathematics/Applied Mathematics
samples into the existing normalized agreement format. It does not download other
agreements or write to PostgreSQL.

Run from the repository root:

```sh
python3 transferplanner/scraper/articulation_parser.py
python3 -m unittest discover -s transferplanner/scraper/tests -v
```

The script's default input is `transferplanner/data/raw/berkeley_cs_2026_2027.json`.

Default output: `transferplanner/data/berkeley_cs_2026_2027_generated.json`.

The second exported response is saved in
`transferplanner/data/raw/berkeley_math_2026_2027.json`. Its converted result is
`transferplanner/data/berkeley_math_2026_2027_generated.json`, produced using
`build_agreement(load_assist_response(path), reviewed_rules)` and JSON serialization.
The default command above regenerates CS only.

The original manually entered agreement stays unchanged for comparison. The
generated core reproduces its three groups, eight requirements, course options,
statuses, and notes. The MATH 54 requirement additionally receives separate
`preparation_options` and `preparation_note` from an explicitly reviewed rule.
Nested JSON strings are decoded, entries are sorted by their
positions, and course mappings are joined by `templateCellId`.

This converter currently accepts the demonstrated required/recommended headings,
AND within course options, explicitly linked OR course alternatives, and whole-course
section counts. It also accepts complete-all `Following` groups and single sections
without a group instruction. OR between sections containing one course each becomes
one normalized group with `required_count: 1`; alternatives containing several rows
or section advisements are rejected because they need a nested model.
Unrecognized relationships, headings, overrides, and unsupported
structures raise errors for review rather than being flattened into simpler rules.

Mathematics has three groups: all of MATH 51/52/53, one of MATH 54/56, and
recommended MATH 55. MATH 56 has no sending-course mapping in this response.
The CS preparation exception does not apply: Mathematics MATH 54 still needs
ENGR 285, MATH 285, or both MATH 260 and MATH 290.

The generated file additionally retains publication metadata and the complete
general-information assets under `source`. Receiving-course attributes are also
preserved under `source.receiving_course_attributes`. `review_required` flags these
notes and general text that may affect the plan. The existing importer does not interpret these extra
fields; do not import generated data until that review is complete.

After reviewing the notes, import an agreement from the repository root:

```sh
.venv/bin/python transferplanner/database/import_courses.py transferplanner/data/berkeley_math_2026_2027_generated.json
```

The file path selects the agreement. This uses the existing catalog and commits
the agreement in one transaction; missing courses stop the import. Supply
`--courses transferplanner/data/mtsac_courses.json` only when catalog importing
is also needed. Both sample agreements' course groups have been reviewed against
their supplied responses. General education and exam credit remain outside the
planner's course-completion calculations.

`transferplanner/data/reviewed_preparation_rules.json` records the approved CS
linear-algebra exception. Applying it requires the same university, major,
college, year, publication date, original options, and source instruction.
A changed publication or instruction raises an error for another review.

Preparation options affect major/group preparation results; the original
`options` still determine full course equivalence. Exam-credit instructions and
other general notes remain preserved for review and are not automatically
interpreted.
