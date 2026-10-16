# AP credit for major preparation

Reviewed October 15, 2026. These policies annotate the receiving university's
requirements. They do not invent completed Mt. SAC courses or add another copy
of AP units to the systemwide UC unit estimate.

| Campus | Exact agreement-year scope | Coverage |
| --- | --- | --- |
| UCLA | 2025–2026 | 69 named programs: 56 with score-based or conditional rules, 13 with exclusions or subject restrictions |
| UC San Diego | 2026–2027 | Campus course exemptions for the 158 imported major/program names, plus explicit departmental waivers |

UCLA majors outside the reviewed 69 remain flagged as unreviewed. A UCSD policy
only applies when the checklist actually contains the awarded course; not every
major has an AP-eligible requirement. Unknown majors and years do not inherit a
different campus's policy.

## Sources and interpretation

- UCLA's major-specific AP instructions are preserved in the corresponding
  `transferplanner/data/generated/ucla` agreement's `source.general_information`.
  These instructions take precedence over general unit or subject awards.
- The ten Samueli agreements explicitly refer to the
  [engineering AP table](https://admission.ucla.edu/admitted-students/ap-credit-engineering).
  Only named course awards are used. Unassigned Computer Science credit does not
  waive COM SCI 31. Chemistry/mechanics credit does not waive the whole lab sequence.
- UCLA language course awards referenced by the European language agreements use
  [the College's AP table](https://admission.ucla.edu/admitted-students/ap-credit-the-college).
  Placement requirements remain separate.
- UCSD uses the university **Course Exemptions (For Use on Major)** column of its
  [2026–27 AP chart](https://catalog.ucsd.edu/_files/advanced-placement-credit-chart-2026.pdf),
  rather than its residential colleges' different GE columns.
- [Global Health's department policy](https://globalhealthprogram.ucsd.edu/undergraduate-program/major.html)
  accepts Statistics AP 3+ for its statistics preparation requirement. This is a
  major waiver, not general PSYC 60 course equivalence.
- [Psychology's department policy](https://psychology.ucsd.edu/undergraduate-program/new-students/freshmen/freshmen-faqs.html)
  excludes AP Statistics and AP Psychology from Psychology major requirements.
- The nine International Studies ASSIST agreements explicitly waive the language
  requirement with language AP 4+ or literature AP 3+. These waivers do not award
  Chinese/Japanese course equivalence or bypass an enrollment placement interview.

## Conditions retained in the planner

- UCLA Economics score 4 requires an exam before May 2021. An optional exam-year
  field appears for score-4 Economics exams when UCLA is selected. Missing or
  invalid years cannot qualify; score 5 does not need this older-exam exception.
- UCLA Communication requires four major-prep courses passed with letter grades
  by the end of fall before the remaining preparation may use AP. Its complex
  preparation structure is still unverified, so prospective AP matches retain
  a direct explanation and cannot automatically become satisfied.
- A UCSD calculus/physics exam applies to one alternative series. The engine
  selects an eligible award matching the most unmet listed requirements; it does
  not simultaneously award both alternatives of the same exam credit.
- Score-specific language awards use score ranges, avoiding the assumption that
  every higher score awards every lower course number.
- Partial AND bundles stay incomplete. Unverified course mappings and group
  conditions remain flagged. An explicitly reviewed International Studies
  language waiver can meet preparation independently of an unknown Mt. SAC
  mapping, while course-equivalence status and group review flags remain intact.
- Regenerating after score, year or major changes clears previous AP annotations.
  College grades, enrollment status, duplicate AP unit exclusions, and the UC
  seven-course pattern retain their separate calculations.

Rules are curated in the campus policy modules and selected by
`ap-major-policy-registry.ts`. Refreshing an ASSIST snapshot or adding a new
agreement year requires another policy review; do not broaden year matching or
infer major credit from general unit awards.
