import { AP_CREDIT_SOURCE, AP_EXAMS, getAPExamUnits } from "@/lib/ap-credit";
import type { APResults } from "@/lib/ap-credit";
import { AP_OVERLAP_SOURCE } from "@/lib/ap-overlap";
import type { APOverlapReport } from "@/lib/ap-overlap";

type APExamSelectorProps = { results: APResults; onChange: (results: APResults) => void; showHeading?: boolean; overlap: APOverlapReport | null; catalogError?: string | null };

export default function APExamSelector({ results, onChange, showHeading = true, overlap, catalogError }: APExamSelectorProps) {
  const selected = AP_EXAMS.filter(exam => results[exam.id]);
  return (
    <section className="ap-panel" aria-labelledby={showHeading ? "ap-heading" : undefined} aria-label={showHeading ? undefined : "AP exams"}>
      <div className="ap-panel-heading">{showHeading && <div><h3 id="ap-heading">AP exams</h3><p>Add exams and the scores you received. Scores of 3–5 generally earn UC unit credit.</p></div>}<a href={AP_CREDIT_SOURCE} target="_blank" rel="noreferrer">UC AP credit table ↗</a></div>
      <div className="form-field ap-add-field"><label htmlFor="add-ap-exam">Add an AP exam</label><select id="add-ap-exam" value="" onChange={event => {
        const id = event.target.value;
        if (id) onChange({ ...results, [id]: { score: "" } });
      }}><option value="">Choose an exam...</option>{AP_EXAMS.filter(exam => !results[exam.id]).map(exam => <option key={exam.id} value={exam.id}>{exam.name}</option>)}</select></div>
      {selected.map(exam => {
        const result = results[exam.id];
        const units = getAPExamUnits(exam, result);
        const check = overlap?.checks.find(item => item.examId === exam.id);
        return <div className="ap-exam" key={exam.id}>
          <div className="ap-exam-heading"><strong>AP {exam.name}</strong><button type="button" className="text-button" aria-label={`Remove AP ${exam.name}`} onClick={() => {
            const next = { ...results };
            delete next[exam.id];
            onChange(next);
          }}>Remove</button></div>
          <div className="ap-score-fields">
            <div className="form-field"><label htmlFor={`ap-score-${exam.id}`}>Exam score</label><select id={`ap-score-${exam.id}`} value={result.score} onChange={event => onChange({ ...results, [exam.id]: { ...result, score: event.target.value } })}><option value="">Select score...</option>{[1, 2, 3, 4, 5].map(score => <option key={score} value={score}>{score}</option>)}</select></div>
            {exam.id === "calculus-bc" && <div className="form-field"><label htmlFor="ap-ab-subscore">AB subscore (optional)</label><select id="ap-ab-subscore" value={result.abSubscore ?? ""} onChange={event => onChange({ ...results, [exam.id]: { ...result, abSubscore: event.target.value } })}><option value="">Not entered</option>{[1, 2, 3, 4, 5].map(score => <option key={score} value={score}>{score}</option>)}</select></div>}
            <p className="ap-exam-units" aria-live="polite">{check?.status === "excluded" ? check.patternAreas.length ? "Excluded from units · AP subject credit still available for the pattern" : "Automatically excluded from units and pattern" : !result.score ? "Enter a score to calculate credit" : `${units} semester units before shared exam caps${check?.status === "review" ? " · provisional" : ""}`}</p>
          </div>
          {exam.note && <p className="ap-exam-note">{exam.note}</p>}
          {check && <p className={`ap-overlap-message ap-overlap-${check.status}`} role="status">{check.message}</p>}
        </div>;
      })}
      {!overlap && <p className="ap-panel-note" role={catalogError ? "alert" : "status"}>{catalogError ? "The catalog could not load, so AP/course overlap has not been checked. Refresh to retry." : "Loading the course catalog before checking AP/course overlap…"}</p>}
      <p className="ap-panel-note">Duplicate checks run automatically when you enter or change college courses, grades and earned units. The estimate keeps college credit and excludes an AP award when all documented equivalents have qualifying grades and valid units. Duplicate units and subject requirements are checked separately: valid AP subject credit stays available until eligible college coursework replaces it in the pattern. Partial matches and unmapped exams retain provisional credit and are flagged for review. This uses <a className="inline-link" href={AP_OVERLAP_SOURCE} target="_blank" rel="noreferrer">Mt. SAC&apos;s course-equivalence table ↗</a> as an overlap estimate; UC&apos;s final award can differ. Shared AP caps remain automatic.</p>
      <p className="ap-panel-note">Generate your plan to apply supported AP substitutions to each major. Major preparation uses campus- and major-specific score rules, separately from unit credit and the seven-course pattern.</p>
      {selected.length > 0 && <button type="button" className="text-button" onClick={() => onChange({})}>Clear AP exams</button>}
    </section>
  );
}
