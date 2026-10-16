import type { MajorAgreement } from "@/lib/planner";
import MajorPlan from "./MajorPlan";

export type AgreementResult = { campus: string; major: string; agreement: MajorAgreement | null; message?: string };

export default function ArticulationAgreements({ agreements, completed, enrolledCourses }: {
  agreements: AgreementResult[]; completed: string[]; enrolledCourses: string[];
}) {
  return <section className="articulation-agreements" aria-labelledby="articulation-heading">
    <h3 id="articulation-heading">Articulation agreements</h3>
    <p className="checklist-note">Status includes accepted AP credit and major-preparation exceptions. OR = choose an option; AND = complete all listed courses.</p>
    {agreements.map(result => <article className="campus-plan" key={result.campus}>
      {result.agreement ? <MajorPlan agreement={result.agreement} completedCourses={completed} enrolledCourses={enrolledCourses} /> : <>
        <h3>{result.campus}</h3><p className="campus-major">{result.major}</p>
        <p className="unavailable-plan">{result.message} Major preparation is not evaluated.</p>
      </>}
    </article>)}
  </section>;
}
