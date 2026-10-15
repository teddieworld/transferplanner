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
university clears the major and year; changing the major clears the year.
Completed Mt. SAC courses stay selected when switching destination agreements.

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
