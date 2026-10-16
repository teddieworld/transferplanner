import type { CourseCatalogEntry } from "@/lib/catalog-types";
import { getCourseEligibility, UC_AREA_LABELS, UC_ELIGIBILITY } from "@/lib/seven-course-pattern";
import type { CoursePatternReviews, UCArea } from "@/lib/seven-course-pattern";
import { getEarnedUnits } from "@/lib/transfer-units";
import { COURSE_TERMS, getCourseApproval } from "@/lib/course-approval";
import CourseApprovalStatus from "./CourseApprovalStatus";
import { PREPARATION_GRADES } from "@/lib/course-credit";

export default function CompletedCourseDetails({ courses, completed, earnedUnits, reviews, onUnitsChange, onReviewsChange }: {
  courses: CourseCatalogEntry[]; completed: string[]; earnedUnits: Record<string, string>;
  reviews: CoursePatternReviews; onUnitsChange: (code: string, value: string) => void;
  onReviewsChange: (reviews: CoursePatternReviews) => void;
}) {
  if (!completed.length) return null;
  return <section className="course-records" aria-labelledby="course-records-heading">
    <h3 id="course-records-heading">Course status and credit details</h3>
    {courses.filter(course => completed.includes(course.code)).map(course => {
      const mapping = getCourseEligibility(course.code);
      const review = reviews[course.code] ?? { grade: "" };
      const enrolled = review.status === "enrolled";
      const approval = getCourseApproval(course.code, courses, completed, reviews);
      const variable = course.minUnits !== course.maxUnits;
      const units = earnedUnits[course.code] ?? "";
      const invalid = units !== "" && getEarnedUnits(course, units) === null;
      return <div className="pattern-course-review" key={course.code}>
        <div><strong>{course.code}</strong> — {course.title}</div>
        <div className="course-record-fields">
          <div className="form-field"><label htmlFor={`course-status-${course.id}`}>Course status for {course.code}</label><select id={`course-status-${course.id}`} value={review.status ?? "completed"} onChange={e => {
            const status = e.target.value === "enrolled" ? "enrolled" : "completed";
            onReviewsChange({ ...reviews, [course.code]: { ...review, status, grade: "" } });
            onUnitsChange(course.code, "");
          }}><option value="completed">Completed</option><option value="enrolled">Currently enrolled</option></select></div>
          {!enrolled && <div className="form-field"><label htmlFor={`pattern-grade-${course.id}`}>Grade earned for {course.code}</label><select id={`pattern-grade-${course.id}`} value={review.grade} onChange={e => onReviewsChange({ ...reviews, [course.code]: { ...review, grade: e.target.value } })}>
            <option value="">Select grade…</option>{["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F", "NP", "W"].map(grade => <option key={grade}>{grade}</option>)}<option value="P">P/CR (equivalent to C or better)</option>
          </select></div>}
          <div className="form-field"><label htmlFor={`completion-term-${course.id}`}>{enrolled ? "Enrollment" : "Completion"} term for {course.code}</label><select id={`completion-term-${course.id}`} value={review.term ?? ""} onChange={e => onReviewsChange({ ...reviews, [course.code]: { ...review, term: e.target.value } })}><option value="">Select term…</option>{COURSE_TERMS.map(term => <option key={term.value} value={term.value}>{term.label}</option>)}</select></div>
          <div className="form-field"><label htmlFor={`completion-year-${course.id}`}>{enrolled ? "Enrollment" : "Completion"} year for {course.code}</label><input id={`completion-year-${course.id}`} type="number" min="1900" max="2100" step="1" placeholder="2026" value={review.year ?? ""} onChange={e => onReviewsChange({ ...reviews, [course.code]: { ...review, year: e.target.value } })} /></div>
          {variable && !enrolled ? <div className="form-field"><label htmlFor={`earned-units-${course.id}`}>Units earned for {course.code}</label><input id={`earned-units-${course.id}`} type="number" min={course.minUnits} max={course.maxUnits} step="any" inputMode="decimal" value={units} placeholder={`${course.minUnits}–${course.maxUnits}`} aria-invalid={invalid} aria-describedby={`unit-range-${course.id}`} onChange={e => onUnitsChange(course.code, e.target.value)} /><p id={`unit-range-${course.id}`} className={invalid ? "unit-input-error" : undefined}>Enter {course.minUnits}–{course.maxUnits} semester units.</p></div> : <p className="record-fixed-units">{course.minUnits === course.maxUnits ? course.minUnits : `${course.minUnits}–${course.maxUnits}`} {enrolled ? "catalog units · not earned yet" : `semester units · ${course.ucTransferable ? "UC transferable" : "Not marked UC transferable"}`}</p>}
        </div>
        {!enrolled && !review.grade && <p className="record-areas">Grade missing. Unit and major matches may change.</p>}
        {!enrolled && review.grade && !PREPARATION_GRADES.has(review.grade) && <p className="record-areas">{["F", "NP", "W"].includes(review.grade) ? `${review.grade}: no earned units or completed requirements.` : `${review.grade}: units may count, but the grade is below C for preparation.`}</p>}
        {mapping ? <>
          <CourseApprovalStatus approval={approval} />
          <details className="course-credit-notes"><summary>ASSIST notes</summary><p className="record-areas">{mapping.areas.map(area => UC_AREA_LABELS[area as UCArea]).join(" · ")} · {UC_ELIGIBILITY.academicYear}</p>{mapping.notes.length > 0 && <ul className="pattern-course-notes">{mapping.notes.map(note => <li key={note}>{note}</li>)}</ul>}</details>
        </> : enrolled ? <CourseApprovalStatus approval={approval} /> : <p className="record-areas">No verified seven-course-pattern area. Transferable units may still count.</p>}
      </div>;
    })}
  </section>;
}
