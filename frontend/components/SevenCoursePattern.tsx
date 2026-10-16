import type { APResults } from "@/lib/ap-credit";
import type { CourseCatalogEntry } from "@/lib/catalog-types";
import { getSevenCourseProgress, UC_ELIGIBILITY } from "@/lib/seven-course-pattern";
import type { CoursePatternReviews } from "@/lib/seven-course-pattern";
import CourseApprovalStatus from "./CourseApprovalStatus";
import { getEarnedUnits, PREPARATION_GRADES } from "@/lib/course-credit";

type Props = {
  courses: CourseCatalogEntry[] | null; isLoading: boolean; error: string | null;
  completedCourses: string[]; earnedUnits: Record<string, string>; apResults: APResults;
  reviews: CoursePatternReviews;
};

export default function SevenCoursePattern({ courses, isLoading, error, completedCourses, earnedUnits, apResults, reviews }: Props) {
  if (isLoading) return <section className="unit-summary" aria-label="UC seven-course pattern"><p role="status">Loading seven-course pattern...</p></section>;
  if (error || !courses) return <section className="unit-summary" aria-label="UC seven-course pattern"><p role="alert">Catalog unavailable. Refresh to check the pattern.</p></section>;
  const progress = getSevenCourseProgress(courses, completedCourses, earnedUnits, reviews, apResults);
  const issues = [...new Set(completedCourses)].filter(code => reviews[code]?.status !== "enrolled").flatMap(code => {
    const course = courses.find(item => item.code === code);
    const approval = progress.approvals.find(item => item.code === code);
    const grade = reviews[code]?.grade;
    const reasons: string[] = [];
    if (!grade) reasons.push("Add a final grade.");
    else if (!PREPARATION_GRADES.has(grade)) reasons.push(`Grade ${grade} does not meet the C-or-better requirement.`);
    if (approval && approval.status !== "eligible") reasons.push(...approval.messages);
    const units = course ? getEarnedUnits(course, earnedUnits[code]) : null;
    if (course && units === null) reasons.push("Enter earned units.");
    else if (units !== null && units < 3) reasons.push("At least 3 earned semester units are required.");
    return reasons.length ? [{ code, reasons }] : [];
  });
  const categories = [
    { name: "English composition", count: progress.english, required: 2, areas: ["UC-E"] },
    { name: "Math and quantitative reasoning", count: progress.math, required: 1, areas: ["UC-M"] },
    { name: "Arts, social sciences and sciences", count: progress.breadth, required: 4, areas: ["UC-H", "UC-B", "UC-S"] }
  ];
  return (
    <section className="unit-summary pattern-summary" aria-labelledby="pattern-heading">
      <div className="unit-summary-heading"><h3 id="pattern-heading">UC seven-course pattern <span>Estimate</span></h3><a href="https://admission.universityofcalifornia.edu/admission-requirements/transfer-requirements/preparing-to-transfer/basic-requirements.html" target="_blank" rel="noreferrer">UC pattern requirements ↗</a></div>
      <p className="pattern-status" role="status">{progress.complete ? "Seven-course pattern matched (estimate)" : `${progress.matchedCount} of 7 course slots matched`}</p>
      <div className="pattern-categories">{categories.map(category => <div className="pattern-category" key={category.name}>
        <h4>{category.name}</h4><p><strong>{category.count} / {category.required}</strong></p>
        {category.required === 4 && <p className="pattern-area-count">{progress.areaCount} of 2 required subject areas{progress.breadth === 4 && progress.areaCount < 2 ? " — choose a course in another area" : ""}</p>}
        <ul>{progress.matches.filter(match => category.areas.includes(match.area)).map(match => <li key={match.id}>{match.label}</li>)}</ul>
      </div>)}</div>
      {issues.length > 0 && <div className="pattern-issues"><h4>Courses not counted</h4><ul>{issues.map(issue => <li key={issue.code}><strong>{issue.code}:</strong> {issue.reasons.join(" ")}</li>)}</ul><p>Edit course details in College courses.</p></div>}
      {progress.approvals.length > 0 && <details className="pattern-review"><summary>Course approval details</summary>
        {progress.approvals.map(approval => <div className="pattern-course-review" key={approval.code}><strong>{approval.code}</strong><CourseApprovalStatus approval={approval} /></div>)}
      </details>}
      <details className="unit-summary-note"><summary>Pattern rules and sources</summary><p>College courses need a C or better, at least 3 semester units, and approval for the course term. Each course or exam fills one slot; AP can fill at most one English slot. Overlapping credit and course-family limits apply. This is the UC admission pattern, separate from campus breadth and major requirements.</p><p>ASSIST Mt. SAC {UC_ELIGIBILITY.academicYear} · checked {UC_ELIGIBILITY.checkedOn}. Other colleges, IB and A-levels are not included.</p><a className="pattern-source-link" href="https://assist.org" target="_blank" rel="noreferrer">Check ASSIST ↗</a></details>
    </section>
  );
}
