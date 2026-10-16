This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## PostgreSQL setup

The UI reads universities, majors, academic years, the Mt. SAC catalog (including
prerequisites), and complete articulation plans from PostgreSQL through server
route handlers. `data/berkeleyCs.ts` is retained as a learning reference; the live
page no longer imports it.

Create `frontend/.env.local` with your local connection settings. For the current
socket connection:

```dotenv
PGDATABASE=transferplanner
PGUSER=your_postgres_user
PGHOST=/tmp
PGPORT=5432
```

Keep credentials out of `NEXT_PUBLIC_` variables. `.env.local` is ignored by Git.

For an existing database created before agreement years were stored, run this
from the repository root:

```sh
psql -d transferplanner -v ON_ERROR_STOP=1 -f transferplanner/database/migrations/001_agreement_years.sql
```

The migration associates the existing Berkeley CS requirements with Mt. SAC and
2026–2027 without deleting requirements or courses. It refuses to guess metadata
for any other unassigned groups. New databases use `schema.sql`, followed by
`seed.sql` and the Python importer. Agreement JSON includes `college` and
`academic_year`; groups and requirements are scoped to their agreement so years
can have different mappings.

Apply the reviewed Berkeley CS preparation exception after migration 001 (or
after creating and importing a new database):

```sh
psql -d transferplanner -v ON_ERROR_STOP=1 -f transferplanner/database/migrations/002_preparation_options.sql
```

The second migration adds preparation options separately from full-equivalence
options and verifies that the existing MATH 54 mappings match the reviewed
source. For this major/year, MATH 260 alone completes the preparation option;
MATH 260 and MATH 290 are still needed for that full-equivalence option. Other
majors and years retain their own rules. Partial articulation still does not
count as complete preparation unless a separate reviewed exception exists.

`getRequirementStatus` checks full equivalence. `getPreparationStatus` uses
reviewed preparation options when present, otherwise the ordinary requirement
status. Required-group/category checks use preparation status. The UI displays
both results when an exception exists. SQL stores option kinds (`equivalence` or
`preparation`) and a preparation note; the importer supports `preparation_options`
without overwriting an existing reviewed exception when importing older JSON.

Before running the updated server/importer on an existing database, apply:

```sh
psql -h /tmp -d transferplanner -v ON_ERROR_STOP=1 -f transferplanner/database/migrations/003_agreement_context.sql
```

Migration 003 adds agreement metadata, group rules, and receiving-department
names. Existing rows retain their mappings. `major_required` groups represent
lower-division degree requirements separately from admission (`required`) groups.
Informational agreements contain guidance without evaluable groups and never
display a satisfied preparation status. The planner shows source notes as plain
text, including department-review instructions and conditions not evaluated by
the course checklist.

American Studies' choice group counts at most two satisfied requirements from
each Berkeley department toward its three-course target. Extra completed courses
are allowed when a valid subset exists. Its introductory group remains marked
for adviser review because the template and prose do not unambiguously agree.

Import another reviewed agreement from the repository root using the existing
Mt. SAC catalog:

```sh
.venv/bin/python transferplanner/database/import_courses.py transferplanner/data/berkeley_math_2026_2027_generated.json
```

The importer accepts one or more reviewed normalized file paths. Each file has
its own transaction and rejects missing course references before inserting
agreement rows. A failed file is rolled back and the remaining files are still
attempted. The terminal prints a success/failure summary; the command exits with
status 1 if any file failed. The catalog is imported only when explicitly supplied with
`--courses transferplanner/data/mtsac_courses.json`. Six saved Berkeley/Mt. SAC
agreements cover 2026–2027, including one informational agreement. Mathematics
keeps the full MATH 54 series; it does not receive the CS preparation exception.
Preserved general-education and exam-credit notes are not evaluated by the planner.

For example, batch import the three reviewed generated agreements from the root:

```sh
.venv/bin/python transferplanner/database/import_courses.py \
  transferplanner/data/generated/berkeley_cs_2026_2027_generated.json \
  transferplanner/data/generated/berkeley_math_2026_2027_generated.json \
  transferplanner/data/generated/berkeley_aeroeng_2026_2027_generated.json
```

Pass agreement files, excluding `batch_report.json`. Repeated imports of the same
unchanged agreement reuse its existing rows.

The importer integration tests use an isolated schema and roll back all test data:

```sh
TRANSFERPLANNER_TEST_DATABASE=transferplanner .venv/bin/python -m unittest discover -s transferplanner/database/tests -p 'test_*.py' -v
```

The schema can be checked in a temporary, rolled-back schema using
`psql -d transferplanner -f transferplanner/database/tests/schema.sql` from the
repository root. This verifies that separate years can contain the same
requirement names without overwriting each other.

Read-only endpoints:

- `/api/universities`
- `/api/majors?university=...`
- `/api/academic-years?university=...&major=...`
- `/api/courses` (Mt. SAC catalog)
- `/api/agreement?university=...&major=...&year=...`

The browser cancels obsolete requests when selections change. Changing a
campus major clears that campus’s agreement year. Unchecking a campus removes
its goal; course and AP entries remain in place.

The planner has four tabs: Colleges & timing, AP credit, College courses, and
Your plan. Students select multiple UC campus goals, an intended major per
campus, their current college year and an intended entry term/year. Major and
source agreement years are selected independently for each campus with imported
agreements. Campuses without imported agreements accept a free-text major goal
and explicitly report that major preparation is not evaluated.

The main screens show inputs, results and short next steps. AP exclusions name
the exam and actual cause (partial sequence, missing grade/units, score threshold
or unavailable overlap rules). Course warnings name the course and the detail
needed. Routine approval checks use a short status; rule explanations, policies
and source notes stay in closed details. Review flags and calculation rules are
unchanged; no flag is dismissed by hiding its source explanation.

College courses supports Completed and Currently enrolled statuses. Enrolled
courses hide grade and earned-unit inputs, use enrollment term/year labels, and
are listed separately in the generated plan. Their course options carry an
In progress label in the remaining checklist and full agreement. They do not
earn units, complete major/pattern requirements, suppress AP units, or trigger
completed-course ordering restrictions. They are not recommended again as retakes.
Switching status clears the prior grade and entered earned units; completion
uses the normal final-grade/credit rules. Status and term persist between tabs
and are captured in the generated snapshot; regenerate after changes.

Completed courses hold transcript grades, completion terms/years and variable
units. `lib/course-approval.ts` automatically checks recorded ASSIST approval
ranges and supported credit conditions; the former confirmation checkbox is gone. Generation captures a snapshot of all entries, fetches
each selected agreement, and builds a remaining-course checklist. Later edits
mark that result as outdated until regeneration. There is no semester scheduling,
admission-term availability check, prerequisite scheduling, or automatic deadline
calculation. Current year and entry term are planning context.

`lib/transfer-plan.ts` preserves AND/OR options, choose-N rules, department caps,
review flags and reviewed preparation exceptions. Additional degree preparation
and recommendations stay separate from admission requirements. Seven-course
suggestions show up to eight example alternatives per category for individual
remaining slots, prioritizing admission-preparation courses and low-grade
retakes. Options are verified against the existing pattern matcher (assuming a future C grade, sufficient earned units and
applicable approval). They are not a single prescribed set of courses. No future
course is added to earned credit. D/C- grades can contribute units but not subject
preparation; F/NP/W do not contribute units. Missing grades leave unit/major
matches provisional. Higher major grade requirements still need source review.
See [UC transfer GPA and unit rules](https://admission.universityofcalifornia.edu/admission-requirements/transfer-requirements/preparing-to-transfer/transfer-gpa.html).

Entries and the generated snapshot stay in `Home` state while tabs switch and
clear on refresh. Arrow keys, Home and End navigate the tabs; the tab bar scrolls
horizontally on small screens.

The generated plan shows estimated UC-transferable semester units toward
a 60-unit target, independently of the selected major's matches.
Only selected courses marked UC transferable contribute. Fixed-unit courses use
their catalog units; variable-unit courses require an earned-unit entry within
the catalog range and are excluded until a valid value is supplied. Removing a
course removes its units; Clear all also resets the earned-unit entries.
AP exams and scores can be added in the AP credit tab. `lib/ap-credit.ts`
records the UC systemwide semester-unit table (checked October 15, 2026), linked
in the UI. Scores 3–5 earn the listed units; scores 1–2 earn none except a
qualifying Calculus BC AB subscore. Shared Art and Design, English, Calculus,
and Physics exam caps are applied. AB exam and BC AB-subscore credit are not
counted twice. Precalculus earns no UC unit credit; Research and Seminar have
no unit credit listed in the source table.

The total separates coursework and AP units. AP/course overlap is now checked
automatically by `lib/ap-overlap.ts`; students no longer toggle an exclusion
checkbox. The AP entry screen explains each exclusion and updates when courses,
grades, earned units or scores change. Generated plans capture the same automatic
check in their snapshot; regenerate after changing entries.

The resolver uses the [Mt. SAC 2026–27 AP course-equivalence table](https://catalog.mtsac.edu/registration-policies/academic-policies-requirements/)
(checked October 15, 2026), documented renamed-course aliases linked in the module,
and honors equivalents already verified in the ASSIST snapshot. This is a
**conservative planning inference from Mt. SAC equivalence**, not a UC campus
credit ruling. [UC awards duplicate exam/course content only once](https://admission.universityofcalifornia.edu/admission-requirements/ap-exam-credits/ap-credits/),
but the public policy does not supply a universal AP-to-Mt. SAC course crosswalk.
The estimate keeps college units and excludes an entire AP award for a documented
full duplicate or an unresolved overlap check. A full match requires every listed
equivalent to have a known C-or-better/P grade, valid positive earned units, and
UC-transferable catalog status. Uncertain credit is withheld as a planning choice,
not classified as a confirmed duplicate. This may undercount the award UC ultimately
grants. The source's minimum equivalence scores are respected:
AB (including a fallback BC AB subscore) requires 4 for automatic matching;
full BC requires 4 and both MATH 180 and 181. Lower qualifying scores with a mapped
overlap are flagged for review and excluded from the estimated unit total.

Multi-course mappings preserve AND, including English Literature, Art History and
two-course language sequences. Partial coverage, missing grades/units and unmapped
exams with potentially credit-bearing coursework have their AP units **withheld**
with an alert to confirm credit with a counselor or UC admissions. No partial unit
deduction is invented. Failed/withdrawn and non-UC courses do not cause an AP unit
exclusion. Removing the coursework causing review restores AP units automatically
when no overlap/review remains; with no coursework to compare, qualifying AP
units count normally.
No department/title guessing is used. Physics prerequisite clearance is not course
equivalence; portfolio-dependent art and other unmapped exams are flagged instead
of assigning an invented equivalent. The CS Principles table has an ambiguous
historical footnote, so that exam is also left for review.

`lib/course-credit.ts` shares grade and earned-unit rules between the resolver,
unit calculator and plan generator. Unit exclusions are separate from pattern subject credit. A qualifying AP exam
retains its UC-designated subject areas until eligible equivalent college courses
(with a qualifying grade, at least 3 units and an applicable approval) cover those
areas. This prevents AP Lang from disappearing when ENGL C1000 is entered without
a valid completion term, while preventing both from adding duplicate English
slots once the college course qualifies. The suggested-course checker also uses
these rules.
Course-area approval dates and supported conditions are checked automatically
from completion terms; unresolved course checks do not count toward the pattern. Supported AP scores are applied separately to major preparation using reviewed campus/major/year policies.
Major preparation also checks `lib/ap-major-policies.ts` through
`applyAPMajorCredit`. These reviewed exceptions are scoped to Berkeley, the exact
major, and the 2026–27 agreement year. Sources are the imported ASSIST exam-credit
notes and the linked Math, Data Science and Engineering policies, checked
2026-10-15. Different majors deliberately have different thresholds (for example,
BC 4 for Engineering/Analytics calculus II versus BC 5 for CS/Data Science).
The generated checklist and full agreement show the exam, score, receiving
requirement and policy link. Unsupported exams/majors/years remain explicitly
unmatched rather than borrowing Mt. SAC AP equivalencies or general UC credit.

AP preparation does not create completed college courses or add units. It updates
preparation matching only; full course equivalence remains separate. AND/OR
requirements, department limits and source review flags still apply. Partial AP
coverage of a bundled science sequence is displayed for review and cannot clear
the sequence. Reviewed Economics rules support both AP exams, or one exam plus
the complementary completed Mt. SAC economics course. Psychology uses at most
one exam-based prerequisite across all groups and reallocates it when college
coursework already fulfills a group. Placement tests, language waivers, ambiguous
source instructions and unreviewed policies still require department review.
Regenerate the plan after changing scores or courses to update these matches.

Clear AP exams resets only AP entries; Clear all in the course list resets courses,
earned units and course reviews.

These entries last only while the page is open. Campus-specific grade requirements, repeats, equivalent or
honors unit-credit limits, and other UC restrictions are not evaluated;
IB/A-level credit and other colleges' coursework are not included. This is a
planning estimate, not a determination of admission eligibility.

### UC seven-course pattern estimate

The generated plan also calculates the UC admission pattern:
two UC-E courses, one UC-M course, and four UC-H/B/S courses across at least two
of those three subject areas. This is separate from Berkeley's degree breadth
and major requirements. The course-area snapshot is
`data/uc-eligibility-mtsac-2025-2026.json`, captured from ASSIST's public UCTEL
response for institution 62 and academic year 76 on October 15, 2026. ASSIST
reported the 2026-2027 eligibility list unavailable and displayed 2025-2026.
Its 277 verified mappings, source URL, footnotes and academic year are preserved.
Courses missing from this snapshot remain unverified, including renamed courses
whose exact current codes are absent; they are not inferred from department names.

In College courses, enter each selected course's transcript grade, completion
term and year. The normalizer now preserves course-version dates and per-area
approval ranges from ASSIST. The automatic checker follows [ASSIST's effective
term definitions](https://resource.assist.org/Portals/0/PDFs/begin_and_end_terms_in_ASSIST.pdf?ver=2020-06-10-125429-350):
begin terms are included; end terms are excluded; explicitly blank ends are
open-ended. Missing metadata is distinct from a deliberate blank. Dates before
the saved course version require historical source data rather than an inferred
approval for a renamed course. Only area approvals active for the entered term
can contribute to the pattern.

Supported conditions are evaluated from **entered** course history: BIOL, CHEM
and PHYS lower/higher-course ordering; GEOL 8/8H restrictions after college-level
astronomy, geology, meteorology or oceanography; shared regular/honors families;
one/two-course and unit-based family caps; algebra/precalculus's single-course
limit; and the single UC-M slot across alternative math preparation paths.
A single physics series is supported; mixing the two listed physics series needs
topic-specific credit review. Same-term ordering cannot be established without
session dates. Missing terms, historical versions, unknown conditions and mixed
physics series are explained and stay pending/review rather than auto-approved.
Changing a course term or removing a related course recomputes these checks.
These checks do not verify unreported coursework, multiple attempts of the same
code, or replace the separate unit-total and major-rule limitations above.

C or better (including P/CR equivalent to C) and at least 3 earned semester units
are still required for a college course to fill a pattern slot. Unknown grades,
missing variable units and unresolved automatic checks do not count. The matched
subset respects shared-family limits even when several courses individually pass
the date/condition check. Unit-based family caps conservatively bound course counts
at one pattern course per 3 units. Generated course examples use approval ranges
at the snapshot's check term (Fall 2026), assume a future qualifying grade and
sufficient units, and must be rechecked for the actual future enrollment term.
No hypothetical course is marked as completed.

Qualifying AP scores use only the UC AP table's explicit E/M/H/B/S designations.
One exam fills one slot, at most one English slot uses AP, and overlapping AP
families count once. The calculator searches possible area assignments so an
H/B course can supply either area, but cannot occupy both. Excluding duplicate AP units does not remove valid AP subject credit when its
college counterpart is still pending or unapproved for the pattern. Partial or unmapped AP/course
overlap withholds units pending counselor/UC admissions review; subject credit is
evaluated separately. Selections, grades and completion terms last only while the page is
open; clearing courses also clears their pattern reviews.

To refresh the source, capture the official UCTEL response, then normalize it
from the repository root (the parser currently validates the known college/year):

```sh
.venv/bin/python transferplanner/scraper/uc_eligibility_parser.py saved_uctel_response.json frontend/data/uc-eligibility-mtsac-2025-2026.json
```

Run `npm test` for planner and SQL-row conversion checks, `npm run lint`, and
`npx tsc --noEmit` for static checks. All endpoints use parameterized SQL and
return JSON errors on failures. Course search reads the full catalog and shows
100 results at a time, with a button to show more.

With the migrated database and development server running, `npm run test:api`
checks the real catalog, agreement endpoints, missing inputs, and unsupported
years. It makes read-only requests against the Berkeley/Mt. SAC CS, Mathematics,
African American Studies, American Studies, and Ancient Civilizations fixtures.
Import these agreements before running it. Set
`TRANSFERPLANNER_TEST_URL` if your server uses a different local port.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

Production: https://transferplanner-teddiesboat.vercel.app

The `transferplanner` Vercel project belongs to the `teddiesboat` scope and is
connected to `teddieworld/transferplanner` on GitHub. Its root directory is
`frontend`, its framework is Next.js, and its production branch is `main`.
It hosts the app and connects to the populated Neon production database. The
production domain is public; Standard Protection keeps preview and generated
deployment URLs behind Vercel sign-in.

To publish an update, save the changes, commit them, and push to `main` on GitHub.
Vercel then builds the pushed commit and updates the production domain when the
deployment succeeds. A local commit alone does not publish anything, and
uncommitted files are not included in Git-triggered deployments. Build status
and logs appear in the Vercel project's Deployments page.

The first deployment was uploaded with the CLI. Its hosting and database changes
still need to be included in the next Git commit before pushing, particularly
`lib/db.ts`, `package.json`, `package-lock.json`, and `vercel.json`. Keep environment
files and `.vercel` out of Git. `.vercelignore` also excludes credentials,
dependencies, and local build output from CLI uploads. `vercel.json` selects
Next.js and the Portland (`pdx1`) function region near the Neon database.

Vercel has production-only `DATABASE_URL` (Secret) and `DATABASE_TRANSPORT=tcp`
(Config). Local development uses its own ignored `frontend/.env.local`, including
the HTTPS transport fallback where needed. Avoid overwriting that file when
pulling Vercel environment variables; pull into a separate file and merge any
needed settings.

Verify the public deployment with the existing read-only tests:

```sh
TRANSFERPLANNER_TEST_URL=https://transferplanner-teddiesboat.vercel.app npm run test:api
```

### Setting up another deployment

The website and PostgreSQL database must both be hosted for the planner to work
when your laptop is off. Vercel runs the Next.js page and API routes; Neon can
host a copy of the existing PostgreSQL database.

1. Create a Neon PostgreSQL project and copy the local database into its empty
   database using `pg_dump` / `pg_restore`. Include the schema, catalog, agreements,
   and metadata. Use a direct (unpooled) connection for database migration.
2. Import this GitHub repository into Vercel. Set **Root Directory** to
   `frontend` and use the **Next.js** framework preset and default build settings.
3. Add Neon's pooled, SSL-enabled connection string as the server environment
   variable `DATABASE_URL` in Vercel. Keep the connection string private; do not
   prefix it with `NEXT_PUBLIC_` or put it in Git. Local `PGHOST=/tmp` settings
   belong only on your laptop.
4. Deploy and verify `/api/universities`, `/api/courses`, and the complete planner
   flow at the generated Vercel URL. A successful build alone does not confirm
   that the hosted database is populated and reachable.

`lib/db.ts` uses `DATABASE_URL` when supplied and otherwise uses the existing
local `PG*` environment variables. See `.env.example` for placeholder settings.
Database migration is a separate step from deployment; Vercel does not copy
your laptop's PostgreSQL database when it builds the repository.

See [Vercel monorepo setup](https://vercel.com/docs/monorepos) and
[Neon's PostgreSQL migration guide](https://neon.com/docs/import/migrate-from-postgres).

### Neon CLI and agent tooling

The repository root contains `neon.ts`, its config dependencies, and project
agent skills in `.agents/skills`. The local `.neon` link and environment files
are ignored by Git. The Neon Codex plugin supplies the MCP server through OAuth;
do not install a second MCP entry when that plugin is already enabled.

After signing in with `neon login`, run these commands from the repository root:

```sh
neon config plan
neon deploy
neon env pull --service postgres --file frontend/.env.local
npm run build
```

`neon deploy` pulls environment variables beside the root `.neon` file. The final
`env pull` also writes them to the Next.js app's own environment file, preserving
its other settings. Keep `DATABASE_URL` on the server; it must not be a
`NEXT_PUBLIC_` variable. Root npm scripts delegate to `frontend`; install its
dependencies separately with `npm --prefix frontend ci`.

The default connection uses `pg` and Vercel's database-pool lifecycle helper.
For a Neon environment where outbound port 5432 is unavailable, set
`DATABASE_TRANSPORT=http` in `frontend/.env.local`. This opts into Neon's HTTPS
driver while preserving the same parameterized queries and result format.
Omit that setting to continue using TCP. HTTPS supports the independent read
queries used by these route handlers; session-based migrations should still use
the direct connection when available.

Production builds use Webpack because Turbopack's helper process cannot bind a
port in the restricted local execution environment. `npm test`, `npm run lint`,
and `npm run test:api` are also available from the repository root. API tests use
`TRANSFERPLANNER_TEST_URL` to select the running server.
