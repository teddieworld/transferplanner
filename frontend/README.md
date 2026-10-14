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

Import another reviewed agreement from the repository root using the existing
Mt. SAC catalog:

```sh
.venv/bin/python transferplanner/database/import_courses.py transferplanner/data/berkeley_math_2026_2027_generated.json
```

The importer accepts the normalized file path as an argument. It imports one
agreement in a transaction and rejects missing course references before inserting
agreement rows. The catalog is imported only when explicitly supplied with
`--courses transferplanner/data/mtsac_courses.json`. CS and Mathematics/Applied
Mathematics each have a Berkeley/Mt. SAC agreement for 2026–2027. Mathematics
keeps the full MATH 54 series; it does not receive the CS preparation exception.
Preserved general-education and exam-credit notes are not evaluated by the planner.

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
years. It makes read-only requests against the Berkeley/Mt. SAC CS and Mathematics
fixtures. Import both agreements before running it. Set
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

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
