import { AP_CREDIT_SOURCE, AP_EXAMS, getAPExamUnits } from "@/lib/ap-credit";
import type { APResults } from "@/lib/ap-credit";

type APExamSelectorProps = { results: APResults; onChange: (results: APResults) => void; showHeading?: boolean };

export default function APExamSelector({ results, onChange, showHeading = true }: APExamSelectorProps) {
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
        return <div className="ap-exam" key={exam.id}>
          <div className="ap-exam-heading"><strong>AP {exam.name}</strong><button type="button" className="text-button" aria-label={`Remove AP ${exam.name}`} onClick={() => {
            const next = { ...results };
            delete next[exam.id];
            onChange(next);
          }}>Remove</button></div>
          <div className="ap-score-fields">
            <div className="form-field"><label htmlFor={`ap-score-${exam.id}`}>Exam score</label><select id={`ap-score-${exam.id}`} value={result.score} onChange={event => onChange({ ...results, [exam.id]: { ...result, score: event.target.value } })}><option value="">Select score...</option>{[1, 2, 3, 4, 5].map(score => <option key={score} value={score}>{score}</option>)}</select></div>
            {exam.id === "calculus-bc" && <div className="form-field"><label htmlFor="ap-ab-subscore">AB subscore (optional)</label><select id="ap-ab-subscore" value={result.abSubscore ?? ""} onChange={event => onChange({ ...results, [exam.id]: { ...result, abSubscore: event.target.value } })}><option value="">Not entered</option>{[1, 2, 3, 4, 5].map(score => <option key={score} value={score}>{score}</option>)}</select></div>}
            <p className="ap-exam-units" aria-live="polite">{result.excludeFromUnits ? "Excluded from unit total" : !result.score ? "Enter a score to calculate credit" : `${units} semester units before shared exam caps`}</p>
          </div>
          {exam.note && <p className="ap-exam-note">{exam.note}</p>}
          <label className="ap-overlap-option"><input type="checkbox" checked={result.excludeFromUnits ?? false} onChange={event => onChange({ ...results, [exam.id]: { ...result, excludeFromUnits: event.target.checked } })} />Exclude this exam&apos;s credit from units and the seven-course pattern (for example, credit already counted through a college course)</label>
        </div>;
      })}
      <p className="ap-panel-note">AP and college coursework with the same content earn credit only once. Review any overlap and exclude duplicate AP credit above. Shared AP exam caps are applied automatically. Qualifying exams with UC subject designations contribute to the seven-course pattern estimate; major requirements use their existing course rules.</p>
      {selected.length > 0 && <button type="button" className="text-button" onClick={() => onChange({})}>Clear AP exams</button>}
    </section>
  );
}
