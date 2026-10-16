import type { APResults } from "@/lib/ap-credit";
import type { CourseCatalogEntry } from "@/lib/catalog-types";
import { getSevenCourseProgress, UC_ELIGIBILITY } from "@/lib/seven-course-pattern";
import type { CoursePatternReviews } from "@/lib/seven-course-pattern";
import CourseApprovalStatus from "./CourseApprovalStatus";

type Props = {
  courses: CourseCatalogEntry[] | null; isLoading: boolean; error: string | null;
  completedCourses: string[]; earnedUnits: Record<string, string>; apResults: APResults;
  reviews: CoursePatternReviews;
};

export default function SevenCoursePattern({ courses, isLoading, error, completedCourses, earnedUnits, apResults, reviews }: Props) {
  if (isLoading) return <section className="unit-summary" aria-label="UC seven-course pattern"><p role="status">Loading seven-course pattern...</p></section>;
  if (error || !courses) return <section className="unit-summary" aria-label="UC seven-course pattern"><p role="alert">The seven-course pattern is unavailable until the catalog loads.</p></section>;
  const progress = getSevenCourseProgress(courses, completedCourses, earnedUnits, reviews, apResults);
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
        <h4>{category.name}</h4><p><strong>{category.count} / {category.required}</strong> {category.areas.join(" · ")}</p>
        {category.required === 4 && <p className="pattern-area-count">{progress.areaCount} of at least 2 subject areas represented{progress.breadth === 4 && progress.areaCount < 2 ? " — add a course in another area" : ""}</p>}
        <ul>{progress.matches.filter(match => category.areas.includes(match.area)).map(match => <li key={match.id}>{match.label} <span>{match.area}</span></li>)}</ul>
      </div>)}</div>
      {progress.pendingCount > 0 && <p className="unit-exclusion">{progress.pendingCount} selected {progress.pendingCount === 1 ? "course needs" : "courses need"} a grade, completion term, valid earned units, or a resolved source condition before counting here.</p>}
      <p className="unit-summary-note">Course areas: ASSIST Mt. SAC {UC_ELIGIBILITY.academicYear}. The app checks recorded approval ranges (begin term included, end term excluded) and supported restrictions against your entries. A blank source end term is open-ended. This is a saved snapshot checked on {UC_ELIGIBILITY.checkedOn}; historical versions, same-term ordering and unhandled conditions are flagged instead of assumed approved.</p>
      {progress.approvals.length > 0 && <details className="pattern-review"><summary>Automatic approval results ({progress.approvals.length})</summary>
        <p>Checks use your entered completion terms and course history. Course-family limits are applied by the pattern matcher, so individually eligible courses may share a single slot. Edit grades, completion terms and units in College courses.</p>
        {progress.approvals.map(approval => <div className="pattern-course-review" key={approval.code}><strong>{approval.code}</strong><CourseApprovalStatus approval={approval} /></div>)}
      </details>}
      {progress.unlisted.length > 0 && <p className="unit-exclusion">No verified area in this snapshot for: {progress.unlisted.join(", ")}. These courses do not count toward this pattern estimate; they may still earn transferable units.</p>}
      <p className="unit-summary-note">Each course or AP exam fills one slot. Only one English slot can use AP credit. Overlapping AP exam families count once. Full documented AP/course matches are automatically excluded using the same rules as the unit estimate; partial or unmapped overlap remains provisional and needs UC review. Excluded AP credit does not replace missing course completion terms or unresolved approval conditions. This checks the UC admission pattern, independently of Berkeley&apos;s seven-course breadth or major requirements. Completion deadlines, other years, other colleges and IB/A-level credit need separate review.</p>
      <a className="pattern-source-link" href="https://assist.org" target="_blank" rel="noreferrer">Review course approvals on ASSIST ↗</a>
    </section>
  );
}
