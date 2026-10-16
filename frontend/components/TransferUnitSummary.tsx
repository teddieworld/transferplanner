import type { CourseCatalogEntry } from "@/lib/catalog-types";
import type { APResults } from "@/lib/ap-credit";
import { AP_EXAMS } from "@/lib/ap-credit";
import type { CoursePatternReviews } from "@/lib/seven-course-pattern";
import { AP_OVERLAP_SOURCE, AP_OVERLAP_REVIEW_NOTICE } from "@/lib/ap-overlap";
import { getEarnedUnits, getTransferUnitProgress, UC_TRANSFER_UNIT_TARGET } from "@/lib/transfer-units";

type TransferUnitSummaryProps = {
  courses: CourseCatalogEntry[] | null;
  isLoading: boolean;
  error: string | null;
  completedCourses: string[];
  earnedUnits: Record<string, string>;
  apResults: APResults;
  onEarnedUnitsChange: (code: string, value: string) => void;
  showInputs?: boolean;
  reviews?: CoursePatternReviews;
};

export default function TransferUnitSummary({
  courses, isLoading, error, completedCourses, earnedUnits, apResults, onEarnedUnitsChange, showInputs = true, reviews = {}
}: TransferUnitSummaryProps) {
  if (isLoading) return <section className="unit-summary" aria-label="UC-transferable units"><p role="status">Loading unit totals...</p></section>;
  if (error || !courses) return <section className="unit-summary" aria-label="UC-transferable units"><p role="alert">Catalog unavailable. Refresh to calculate units.</p></section>;

  const progress = getTransferUnitProgress(courses, completedCourses, earnedUnits, apResults, reviews);
  const missingUnits = progress.variableCourses.filter(course => getEarnedUnits(course, earnedUnits[course.code]) === null).map(course => course.code);
  const missingScores = AP_EXAMS.filter(exam => apResults[exam.id] && !/^[1-5]$/.test(apResults[exam.id].score)).map(exam => exam.name);
  const selected = [...new Set(completedCourses)];
  const nonUC = selected.filter(code => courses.some(course => course.code === code && !course.ucTransferable));
  const unknown = selected.filter(code => !courses.some(course => course.code === code));
  return (
    <section className="unit-summary" aria-labelledby="unit-summary-heading">
      <div className="unit-summary-heading">
        <h3 id="unit-summary-heading">UC-transferable units <span>Estimate</span></h3>
        <a href="https://admission.universityofcalifornia.edu/admission-requirements/transfer-requirements/preparing-to-transfer/basic-requirements.html" target="_blank" rel="noreferrer">UC transfer requirements ↗</a>
      </div>
      <div className="unit-summary-progress" aria-live="polite" aria-atomic="true">
        <p className="unit-total"><strong>{progress.totalUnits}</strong> / {UC_TRANSFER_UNIT_TARGET} semester units</p>
        <p className="unit-remaining">{progress.targetReached ? "60-unit target reached (estimate)" : `${progress.remainingUnits} more units to reach the target`}</p>
        {missingUnits.length > 0 && <p>Add earned units in College courses: {missingUnits.join(", ")}. Not counted yet.</p>}
      </div>
      <div className="unit-progress-track" role="progressbar" aria-label="Estimated UC-transferable semester units" aria-valuemin={0} aria-valuemax={UC_TRANSFER_UNIT_TARGET} aria-valuenow={Math.min(progress.totalUnits, UC_TRANSFER_UNIT_TARGET)} aria-valuetext={`${progress.totalUnits} of ${UC_TRANSFER_UNIT_TARGET} semester units, estimated`}>
        <span style={{ width: `${Math.min(progress.totalUnits / UC_TRANSFER_UNIT_TARGET, 1) * 100}%` }} />
      </div>
      <p className="unit-breakdown">Mt. SAC coursework: {progress.courseUnits} units <span aria-hidden="true">·</span> AP exams: {progress.apCredit.units} units</p>
      {missingScores.length > 0 && <p className="unit-exclusion">Add scores in AP credit: {missingScores.join(", ")}. Not counted yet.</p>}
      {progress.apCredit.overlap.checks.some(check => check.status !== "clear") && <div className="ap-overlap-summary" role={progress.apCredit.overlap.checks.some(check => check.status === "review") ? "alert" : undefined}><h4>AP units not counted</h4><ul>{progress.apCredit.overlap.checks.filter(check => check.status !== "clear").map(check => <li key={check.examId}><strong>AP {check.examName}:</strong> {check.reason}</li>)}</ul>{progress.apCredit.overlap.checks.some(check => check.status === "review") && <p>{AP_OVERLAP_REVIEW_NOTICE}</p>}</div>}
      {progress.apCredit.capNotes.length > 0 && <ul className="ap-cap-notes">{progress.apCredit.capNotes.map(note => <li key={note}>{note}</li>)}</ul>}
      {showInputs && progress.variableCourses.length > 0 && <div className="earned-unit-fields">
        <p>For variable-unit courses, enter the units earned on your transcript. Unfilled or out-of-range entries are not counted.</p>
        {progress.variableCourses.map(course => {
          const value = earnedUnits[course.code] ?? "";
          const invalid = value !== "" && getEarnedUnits(course, value) === null;
          return <div className="earned-unit-row" key={course.code}>
            <label htmlFor={`earned-units-${course.id}`}><strong>{course.code}</strong> — {course.title}<span>{course.minUnits}–{course.maxUnits} semester units</span></label>
            <div><input id={`earned-units-${course.id}`} aria-label={`Units earned for ${course.code}`} type="number" min={course.minUnits} max={course.maxUnits} step="any" inputMode="decimal" placeholder="Units" value={value} onChange={event => onEarnedUnitsChange(course.code, event.target.value)} aria-invalid={invalid} aria-describedby={invalid ? `unit-error-${course.id}` : undefined} />
              {invalid && <p className="unit-input-error" id={`unit-error-${course.id}`}>Enter {course.minUnits}–{course.maxUnits} units.</p>}
            </div>
          </div>;
        })}
      </div>}
      {nonUC.length > 0 && <p className="unit-exclusion">Not UC transferable: {nonUC.join(", ")}. Units excluded.</p>}
      {unknown.length > 0 && <p className="unit-exclusion">Courses not found: {unknown.join(", ")}. Units excluded; check the course codes.</p>}
      <details className="unit-summary-note"><summary>What this estimate includes</summary><p>Entered Mt. SAC courses and AP scores. Enrolled courses, duplicate AP units and AP units needing review are excluded. IB, A-levels and other colleges are not included. UC makes the final credit decision.</p><a className="inline-link" href={AP_OVERLAP_SOURCE} target="_blank" rel="noreferrer">AP overlap source ↗</a></details>
    </section>
  );
}
