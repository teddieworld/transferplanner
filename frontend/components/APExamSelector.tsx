import { AP_CREDIT_SOURCE, AP_EXAMS, getAPExamUnits } from "@/lib/ap-credit";
import type { APResults } from "@/lib/ap-credit";
import { AP_OVERLAP_SOURCE } from "@/lib/ap-overlap";
import type { APOverlapReport } from "@/lib/ap-overlap";

type APExamSelectorProps = { results: APResults; onChange: (results: APResults) => void; showHeading?: boolean; overlap: APOverlapReport | null; catalogError?: string | null; showEconomicsYear?: boolean };

export default function APExamSelector({ results, onChange, showHeading = true, overlap, catalogError, showEconomicsYear = false }: APExamSelectorProps) {
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
            {showEconomicsYear && ["microeconomics", "macroeconomics"].includes(exam.id) && result.score === "4" && <div className="form-field"><label htmlFor={`ap-year-${exam.id}`}>Exam year (for UCLA credit)</label><input id={`ap-year-${exam.id}`} type="number" min="1950" max="2100" placeholder="Optional" value={result.examYear ?? ""} onChange={event => onChange({ ...results, [exam.id]: { ...result, examYear: event.target.value } })} /></div>}
            <p className="ap-exam-units" aria-live="polite">{check?.status === "review" ? "0 units · needs review" : check?.status === "excluded" ? "0 units · duplicate credit" : !result.score ? "Choose a score" : `${units} semester units before shared limits`}</p>
          </div>
          {exam.note && <p className="ap-exam-note">{exam.note}</p>}
          {result.score && Number(result.score) < 3 && units === 0 && <p className="ap-exam-note">{exam.id === "calculus-bc" ? "Score below 3. Add a qualifying AB subscore if available." : "Score below 3: no UC credit."}</p>}
          {check && check.status !== "clear" && <p className={`ap-overlap-message ap-overlap-${check.status}`} role={check.status === "review" ? "alert" : "status"}>{check.message}</p>}
        </div>;
      })}
      {!overlap && <p className="ap-panel-note" role={catalogError ? "alert" : "status"}>{catalogError ? "Catalog unavailable. Refresh to check AP overlap." : "Checking AP overlap…"}</p>}
      <details className="ap-panel-note"><summary>How AP credit is counted</summary><p>Duplicate or uncertain AP units are excluded. Major requirements and the seven-course pattern are checked separately in Your plan.</p><a className="inline-link" href={AP_OVERLAP_SOURCE} target="_blank" rel="noreferrer">Mt. SAC AP equivalencies ↗</a></details>
      {selected.length > 0 && <button type="button" className="text-button" onClick={() => onChange({})}>Clear AP exams</button>}
    </section>
  );
}
