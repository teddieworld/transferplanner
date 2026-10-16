import type { CourseCatalogEntry } from "@/lib/catalog-types";
import type { MajorAgreement, RequirementGroup } from "@/lib/planner";
import { getRemainingGroup } from "@/lib/transfer-plan";
import type { getPatternSuggestions } from "@/lib/transfer-plan";
import RequirementDisplay from "./RequirementDisplay";
import MajorPlan from "./MajorPlan";
import APPreparationCredit from "./APPreparationCredit";
import { EXAMPLE_COURSE_TERM, formatTerm } from "@/lib/course-approval";

export type AgreementResult = { campus: string; major: string; agreement: MajorAgreement | null; message?: string };

function RemainingGroups({ groups, completed }: { groups: RequirementGroup[]; completed: string[] }) {
  if (!groups.length) return <p className="checklist-note">No separate checklist was supplied in this agreement. Read the agreement guidance.</p>;
  return groups.map((group, index) => {
    const remaining = getRemainingGroup(group, completed);
    return <section className="remaining-group" key={`${group.name}-${index}`}>
      <div className="remaining-heading"><h4>Group {group.name}</h4><span className={`status-badge status-${group.reviewRequired ? "review_required" : remaining.complete ? "satisfied" : "not_satisfied"}`}>{group.reviewRequired ? "Needs adviser review" : remaining.complete ? "Matched" : "Remaining"}</span></div>
      {group.reviewRequired ? <p className="checklist-note">Completion rules need adviser review. The options below are source information, not an automatically generated course prescription.</p>
        : remaining.complete ? <p className="checklist-note">Your entered coursework and supported AP credit match this group&apos;s preparation rules.</p>
          : <p className="checklist-note">{group.requiredCount === null ? `Complete the ${remaining.remainingCount} remaining requirement${remaining.remainingCount === 1 ? "" : "s"} below.` : `Choose ${remaining.remainingCount} more requirement${remaining.remainingCount === 1 ? "" : "s"} from the alternatives below; not every listed alternative is required.`}</p>}
      {group.maxPerDepartment !== undefined && <p className="checklist-note">No more than {group.maxPerDepartment} matched requirements per department count. {remaining.matchedRequirements.length} requirements currently have course matches; department limits still apply.</p>}
      {group.note && <details className="group-notes"><summary>Group conditions</summary><p>{group.note}</p></details>}
      {!group.reviewRequired && remaining.matchedRequirements.filter(requirement => requirement.apPreparation).map((requirement, i) => <APPreparationCredit key={`${requirement.name}-${i}`} requirement={requirement} />)}
      {(!remaining.complete || group.reviewRequired) && (group.reviewRequired ? group.requirements : remaining.requirements).map((requirement, i) => <RequirementDisplay key={`${requirement.name}-${i}`} requirement={requirement} completedCourses={completed} />)}
      {!remaining.complete && !group.reviewRequired && remaining.requirements.length === 0 && <p className="checklist-note">Review the full agreement to resolve group limits and available choices.</p>}
    </section>;
  });
}

function SuggestedCourses({ courses }: { courses: CourseCatalogEntry[] }) {
  return <ul className="suggested-courses">{courses.map(course => <li key={course.code}><strong>{course.code}</strong> — {course.title} <span>({course.minUnits === course.maxUnits ? course.minUnits : `${course.minUnits}–${course.maxUnits}`} units)</span>
    {course.requirements.length > 0 && <details><summary>Prerequisites and catalog conditions</summary>{course.requirements.map((requirement, index) => <p key={index}>{requirement.text}</p>)}</details>}
  </li>)}</ul>;
}

export default function GeneratedChecklist({ agreements, completed, suggestions, remainingUnits }: {
  agreements: AgreementResult[]; completed: string[];
  suggestions: ReturnType<typeof getPatternSuggestions>; remainingUnits: number;
}) {
  return <div className="generated-checklist">
    <section className="checklist-section" aria-labelledby="remaining-pattern-heading"><h3 id="remaining-pattern-heading">Finish the UC seven-course pattern</h3>
      <p className="checklist-note">These are example alternatives for remaining slots, using the saved ASSIST snapshot and {formatTerm(EXAMPLE_COURSE_TERM)} approval ranges. Choose courses alongside your major preparation. A course may also support your major and units, but fills only one pattern slot. Recheck for your actual enrollment term, prerequisites and availability; no semester schedule is calculated.</p>
      {suggestions.every(item => item.remaining === 0) ? <p className="checklist-complete">All seven slots and the subject-area distribution are matched in your estimate.</p> : suggestions.filter(item => item.remaining > 0).map(item => <div className="pattern-next-step" key={item.name}>
        <h4>{item.name}</h4><p>{item.remaining} more {item.remaining === 1 ? "slot" : "slots"}{item.areas[0] === "UC-H" ? " · four courses across at least two of UC-H, UC-B and UC-S; a full single-area set needs a replacement" : ""}.</p>
        {item.courses.length ? <details><summary>View {item.courses.length} example Mt. SAC courses</summary><p className="checklist-note">Alternatives for one slot at a time. Do not take this entire list. These options assume a qualifying grade and at least 3 earned semester units; combinations and equivalent courses need another check. A previously attempted course may appear as a retake option when its grade is below C.</p><SuggestedCourses courses={item.courses} /></details> : <p className="checklist-note">Review pending grades and approvals in College courses, then consult ASSIST or an adviser for applicable options.</p>}
      </div>)}
    </section>
    <section className="checklist-section" aria-labelledby="major-checklist-heading"><h3 id="major-checklist-heading">Major preparation by campus</h3>
      <p className="checklist-note">Complete admission preparation by the campus and major&apos;s applicable deadline. “OR” separates alternatives; “AND” means courses belong together. Supported AP scores are checked against each major&apos;s reviewed policy. Matches still need a review of grades and agreement conditions.</p>
      {agreements.map(result => <article className="campus-plan" key={result.campus}>
        <h3>{result.campus}</h3><p className="campus-major">{result.major}</p>
        {!result.agreement ? <p className="unavailable-plan">{result.message} General UC units and pattern progress are included; major preparation has not been evaluated.</p> : <>
          <p className="checklist-note">ASSIST agreement: <strong>{result.agreement.academicYear}</strong>. This is the course-mapping source year, not your intended entry term. Confirm it applies to the courses you plan to take.</p>
          {result.agreement.apPreparationReview && <div className="group-guidance"><p>{result.agreement.apPreparationReview.message}</p>{result.agreement.apPreparationReview.unmatchedExams.length > 0 && <p>No automatic major match: {result.agreement.apPreparationReview.unmatchedExams.join("; ")}. Unit credit and seven-course pattern credit are evaluated separately.</p>}</div>}
          {result.agreement.kind === "informational" ? <p className="unavailable-plan">This agreement contains program guidance rather than a calculable checklist. Review the full agreement and consult an adviser.</p> : <>
            <h4 className="checklist-category-title">Required for admission</h4><RemainingGroups groups={result.agreement.requiredGroups} completed={completed} />
            {(result.agreement.majorRequiredGroups?.length ?? 0) > 0 && <details className="preparation-extras"><summary>Additional lower-division major preparation</summary><p className="checklist-note">Some degree requirements can be completed after transfer. Check the agreement before treating them as admission requirements.</p><RemainingGroups groups={result.agreement.majorRequiredGroups!} completed={completed} /></details>}
            {result.agreement.highlyRecommendedGroups.length > 0 && <details className="preparation-extras"><summary>Highly recommended preparation</summary><RemainingGroups groups={result.agreement.highlyRecommendedGroups} completed={completed} /></details>}
          </>}
          <details className="full-agreement"><summary>View full agreement, completed matches and source notes</summary><MajorPlan agreement={result.agreement} completedCourses={completed} /></details>
        </>}
      </article>)}
    </section>
    <section className="checklist-section"><h3>Reach 60 transferable semester units</h3><p className="checklist-note">{remainingUnits > 0 ? `You still need an estimated ${remainingUnits} UC-transferable semester units. Courses you complete from the lists above may reduce this gap. Then choose additional UC-transferable electives as needed; do not add this gap on top of those course units.` : "Your entered coursework and AP scores reach the estimated 60-unit target."} Planned courses are not counted as earned credit. Repeats, overlapping credit and campus limits still need review.</p></section>
  </div>;
}
