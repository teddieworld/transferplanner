"use client";

import { useRemoteData } from "@/lib/use-remote-data";
import type { Major } from "@/lib/catalog-types";
import type { Campus, CampusChoice } from "@/lib/transfer-plan";

export default function TargetCollege({ campus, choice, onChange }: {
  campus: Campus; choice: CampusChoice; onChange: (choice: CampusChoice) => void;
}) {
  const { data: majors, isLoading, error } = useRemoteData<Major[]>(`/api/majors?${new URLSearchParams({ university: campus.name })}`);
  const hasMajors = Boolean(majors?.length);
  const { data: years, isLoading: loadingYears, error: yearError } = useRemoteData<string[]>(hasMajors && choice.major
    ? `/api/academic-years?${new URLSearchParams({ university: campus.name, major: choice.major })}` : null);
  return <section className="target-college" aria-labelledby={`target-${campus.id}`}>
    <h3 id={`target-${campus.id}`}>{campus.label}</h3>
    <div className="target-fields">
      <div className="form-field"><label htmlFor={`major-${campus.id}`}>Intended major at {campus.label}</label>
        {hasMajors ? <select id={`major-${campus.id}`} value={choice.major} onChange={e => onChange({ major: e.target.value, academicYear: "" })}>
          <option value="">Choose a major</option>{majors!.map(major => <option key={major.id} value={major.name}>{major.name}</option>)}
        </select> : <input id={`major-${campus.id}`} value={choice.major} disabled={isLoading || Boolean(error)} placeholder={isLoading ? "Loading majors…" : "For example, Computer Science"} onChange={e => onChange({ major: e.target.value, academicYear: "" })} />}
        {!isLoading && !error && !hasMajors && <p>Major agreements are not available here yet. We&apos;ll save your intended major and show general UC transfer progress.</p>}
        {error && <p role="alert">{error}</p>}
      </div>
      {hasMajors && <div className="form-field"><label htmlFor={`year-${campus.id}`}>ASSIST agreement year</label><select id={`year-${campus.id}`} value={choice.academicYear} disabled={!years?.length || loadingYears} onChange={e => onChange({ ...choice, academicYear: e.target.value })}>
        <option value="">{loadingYears ? "Loading years…" : "Choose an agreement year"}</option>{years?.map(year => <option key={year} value={year}>{year}</option>)}
      </select><p>This is the source year for course mappings, separate from when you plan to enter UC. Use the year that applies to your coursework.</p>
      {yearError && <p role="alert">{yearError}</p>}
      {choice.major && years?.length === 0 && <p>No agreement years are available for this major.</p>}</div>}
    </div>
  </section>;
}
