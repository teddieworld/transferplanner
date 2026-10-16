import type { CourseCatalogEntry } from "@/lib/catalog-types";
import type { APResults } from "@/lib/ap-credit";
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
};

export default function TransferUnitSummary({
  courses, isLoading, error, completedCourses, earnedUnits, apResults, onEarnedUnitsChange, showInputs = true
}: TransferUnitSummaryProps) {
  if (isLoading) return <section className="unit-summary" aria-label="UC-transferable units"><p role="status">Loading unit totals...</p></section>;
  if (error || !courses) return <section className="unit-summary" aria-label="UC-transferable units"><p role="alert">Unit totals are unavailable until the course catalog loads.</p></section>;

  const progress = getTransferUnitProgress(courses, completedCourses, earnedUnits, apResults);
  return (
    <section className="unit-summary" aria-labelledby="unit-summary-heading">
      <div className="unit-summary-heading">
        <h3 id="unit-summary-heading">UC-transferable units <span>Estimate</span></h3>
        <a href="https://admission.universityofcalifornia.edu/admission-requirements/transfer-requirements/preparing-to-transfer/basic-requirements.html" target="_blank" rel="noreferrer">UC transfer requirements ↗</a>
      </div>
      <div className="unit-summary-progress" aria-live="polite" aria-atomic="true">
        <p className="unit-total"><strong>{progress.totalUnits}</strong> / {UC_TRANSFER_UNIT_TARGET} semester units</p>
        <p className="unit-remaining">{progress.targetReached ? "60-unit target reached (estimate)" : `${progress.remainingUnits} more units to reach the target`}</p>
        {progress.pendingCount > 0 && <p>{progress.pendingCount} variable-unit {progress.pendingCount === 1 ? "course needs" : "courses need"} earned units before being counted.</p>}
      </div>
      <div className="unit-progress-track" role="progressbar" aria-label="Estimated UC-transferable semester units" aria-valuemin={0} aria-valuemax={UC_TRANSFER_UNIT_TARGET} aria-valuenow={Math.min(progress.totalUnits, UC_TRANSFER_UNIT_TARGET)} aria-valuetext={`${progress.totalUnits} of ${UC_TRANSFER_UNIT_TARGET} semester units, estimated`}>
        <span style={{ width: `${Math.min(progress.totalUnits / UC_TRANSFER_UNIT_TARGET, 1) * 100}%` }} />
      </div>
      <p className="unit-breakdown">Mt. SAC coursework: {progress.courseUnits} units <span aria-hidden="true">·</span> AP exams: {progress.apCredit.units} units</p>
      {progress.apCredit.pendingCount > 0 && <p className="unit-exclusion">{progress.apCredit.pendingCount} AP {progress.apCredit.pendingCount === 1 ? "exam needs a score" : "exams need scores"} before being counted.</p>}
      {progress.apCredit.excludedCount > 0 && <p className="unit-exclusion">{progress.apCredit.excludedCount} AP {progress.apCredit.excludedCount === 1 ? "exam is" : "exams are"} manually excluded from the unit total.</p>}
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
      {progress.nonUCCount > 0 && <p className="unit-exclusion">{progress.nonUCCount} selected {progress.nonUCCount === 1 ? "course is" : "courses are"} not marked UC transferable and excluded from this total.</p>}
      {progress.unknownCount > 0 && <p className="unit-exclusion">{progress.unknownCount} selected {progress.unknownCount === 1 ? "course could" : "courses could"} not be found in the catalog and {progress.unknownCount === 1 ? "is" : "are"} excluded.</p>}
      <p className="unit-summary-note">Based on selected Mt. SAC courses and entered AP scores. AP/course overlap must be reviewed manually. Review transcript grades, repeats, equivalent/honors course limits, and other UC credit restrictions before relying on this estimate. IB/A-level credit and coursework from other colleges are not included. Reaching 60 units alone does not establish transfer eligibility.</p>
    </section>
  );
}
