import type { CourseCatalogEntry } from "@/lib/catalog-types";
import { getCourseEligibility, UC_AREA_LABELS, UC_ELIGIBILITY } from "@/lib/seven-course-pattern";
import type { CoursePatternReviews, UCArea } from "@/lib/seven-course-pattern";
import { getEarnedUnits } from "@/lib/transfer-units";

export default function CompletedCourseDetails({ courses, completed, earnedUnits, reviews, onUnitsChange, onReviewsChange }: {
  courses: CourseCatalogEntry[]; completed: string[]; earnedUnits: Record<string, string>;
  reviews: CoursePatternReviews; onUnitsChange: (code: string, value: string) => void;
  onReviewsChange: (reviews: CoursePatternReviews) => void;
}) {
  if (!completed.length) return null;
  return <section className="course-records" aria-labelledby="course-records-heading">
    <h3 id="course-records-heading">Course grades and credit details</h3>
    <p>Use your transcript for grades and earned units. Missing grades make unit and major matches provisional. F, NP and W earn no units here; grades below C do not complete subject preparation. Some majors require higher grades.</p>
    {courses.filter(course => completed.includes(course.code)).map(course => {
      const mapping = getCourseEligibility(course.code);
      const review = reviews[course.code] ?? { grade: "", approvalConfirmed: false };
      const variable = course.minUnits !== course.maxUnits;
      const units = earnedUnits[course.code] ?? "";
      const invalid = units !== "" && getEarnedUnits(course, units) === null;
      return <div className="pattern-course-review" key={course.code}>
        <div><strong>{course.code}</strong> — {course.title}</div>
        <div className="course-record-fields">
          <div className="form-field"><label htmlFor={`pattern-grade-${course.id}`}>Grade earned for {course.code}</label><select id={`pattern-grade-${course.id}`} value={review.grade} onChange={e => onReviewsChange({ ...reviews, [course.code]: { ...review, grade: e.target.value } })}>
            <option value="">Select grade…</option>{["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F", "NP", "W"].map(grade => <option key={grade}>{grade}</option>)}<option value="P">P/CR (equivalent to C or better)</option>
          </select></div>
          {variable ? <div className="form-field"><label htmlFor={`earned-units-${course.id}`}>Units earned for {course.code}</label><input id={`earned-units-${course.id}`} type="number" min={course.minUnits} max={course.maxUnits} step="any" inputMode="decimal" value={units} placeholder={`${course.minUnits}–${course.maxUnits}`} aria-invalid={invalid} aria-describedby={`unit-range-${course.id}`} onChange={e => onUnitsChange(course.code, e.target.value)} /><p id={`unit-range-${course.id}`} className={invalid ? "unit-input-error" : undefined}>Enter {course.minUnits}–{course.maxUnits} semester units.</p></div> : <p className="record-fixed-units">{course.minUnits} semester units · {course.ucTransferable ? "UC transferable" : "Not marked UC transferable"}</p>}
        </div>
        {mapping ? <><p className="record-areas">{mapping.areas.map(area => `${area}: ${UC_AREA_LABELS[area as UCArea]}`).join(" · ")} · ASSIST {UC_ELIGIBILITY.academicYear}</p>
          {mapping.notes.length > 0 && <details className="course-credit-notes"><summary>Credit conditions to review</summary><ul className="pattern-course-notes">{mapping.notes.map(note => <li key={note}>{note}</li>)}</ul></details>}
          <label className="ap-overlap-option"><input type="checkbox" checked={review.approvalConfirmed} onChange={e => onReviewsChange({ ...reviews, [course.code]: { ...review, approvalConfirmed: e.target.checked } })} />I checked that the ASSIST approval applies to my course term and that I meet its listed credit conditions.</label>
        </> : <p className="record-areas">No verified seven-course-pattern area in our current snapshot. This course may still contribute transferable units.</p>}
      </div>;
    })}
  </section>;
}
