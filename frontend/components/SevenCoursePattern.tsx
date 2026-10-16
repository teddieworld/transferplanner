import type { APResults } from "@/lib/ap-credit";
import type { CourseCatalogEntry } from "@/lib/catalog-types";
import { getCourseEligibility, getSevenCourseProgress, UC_AREA_LABELS, UC_ELIGIBILITY } from "@/lib/seven-course-pattern";
import type { CoursePatternReviews } from "@/lib/seven-course-pattern";

type Props = {
  courses: CourseCatalogEntry[] | null; isLoading: boolean; error: string | null;
  completedCourses: string[]; earnedUnits: Record<string, string>; apResults: APResults;
  reviews: CoursePatternReviews; onReviewsChange: (reviews: CoursePatternReviews) => void;
  showReview?: boolean;
};

export default function SevenCoursePattern({ courses, isLoading, error, completedCourses, earnedUnits, apResults, reviews, onReviewsChange, showReview = true }: Props) {
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
      {progress.pendingCount > 0 && <p className="unit-exclusion">{progress.pendingCount} selected {progress.pendingCount === 1 ? "course needs" : "courses need"} a grade, valid earned units, or approval confirmation before counting here.</p>}
      <p className="unit-summary-note">Course areas: ASSIST Mt. SAC {UC_ELIGIBILITY.academicYear}. At our {UC_ELIGIBILITY.checkedOn} check, ASSIST displayed this list because 2026–2027 was unavailable. Confirm the approval dates and restrictions apply to each course you took; listings can change by year.</p>
      {showReview && progress.reviewCourses.length > 0 && <details className="pattern-review"><summary>Review selected course grades and approvals ({progress.reviewCourses.length})</summary>
        <p>Only grades C or better, or P/CR equivalent to C or better, count. Each college course needs at least 3 semester units. Enter variable units in the unit tracker above.</p>
        {progress.reviewCourses.map(course => {
          const mapping = getCourseEligibility(course.code)!;
          const review = reviews[course.code] ?? { grade: "", approvalConfirmed: false };
          return <div className="pattern-course-review" key={course.code}>
            <div><strong>{course.code}</strong> — {course.title}<p>{mapping.areas.map(area => `${area}: ${UC_AREA_LABELS[area as keyof typeof UC_AREA_LABELS]}`).join(" · ")}</p></div>
            <div className="form-field pattern-grade"><label htmlFor={`pattern-grade-${course.id}`}>Grade earned</label><select id={`pattern-grade-${course.id}`} value={review.grade} onChange={event => onReviewsChange({ ...reviews, [course.code]: { ...review, grade: event.target.value } })}>
              <option value="">Select grade...</option>{["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F", "NP", "W"].map(grade => <option key={grade} value={grade}>{grade}</option>)}<option value="P">P/CR (equivalent to C or better)</option>
            </select></div>
            {mapping.notes.length > 0 && <ul className="pattern-course-notes">{mapping.notes.map(note => <li key={note}>{note}</li>)}</ul>}
            <label className="ap-overlap-option"><input type="checkbox" checked={review.approvalConfirmed} onChange={event => onReviewsChange({ ...reviews, [course.code]: { ...review, approvalConfirmed: event.target.checked } })} />I checked that the ASSIST approval applies to my course term and that I meet its listed credit conditions.</label>
          </div>;
        })}
      </details>}
      {progress.unlisted.length > 0 && <p className="unit-exclusion">No verified area in this snapshot for: {progress.unlisted.join(", ")}. These courses do not count toward this pattern estimate; they may still earn transferable units.</p>}
      <p className="unit-summary-note">Each course or AP exam fills one slot. Only one English slot can use AP credit. Overlapping AP exam families count once; exclude AP credit that duplicates college courses in the AP section. This checks the UC admission pattern, independently of Berkeley&apos;s seven-course breadth or major requirements. Completion deadlines, other years, other colleges and IB/A-level credit need separate review.</p>
      <a className="pattern-source-link" href="https://assist.org" target="_blank" rel="noreferrer">Review course approvals on ASSIST ↗</a>
    </section>
  );
}
