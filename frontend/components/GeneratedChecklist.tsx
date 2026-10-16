import type { CourseCatalogEntry } from "@/lib/catalog-types";
import type { MajorAgreement, RequirementGroup } from "@/lib/planner";
import { getRemainingGroup } from "@/lib/transfer-plan";
import type { getPatternSuggestions } from "@/lib/transfer-plan";
import RequirementDisplay from "./RequirementDisplay";
import MajorPlan from "./MajorPlan";
import APPreparationCredit from "./APPreparationCredit";
import MajorAPReview from "./MajorAPReview";
import { groupReviewMessage } from "@/lib/planner-copy";
import { EXAMPLE_COURSE_TERM, formatTerm } from "@/lib/course-approval";

export type AgreementResult = { campus: string; major: string; agreement: MajorAgreement | null; message?: string };

function RemainingGroups({ groups, completed, enrolledCourses }: { groups: RequirementGroup[]; completed: string[]; enrolledCourses: string[] }) {
  if (!groups.length) return <p className="checklist-note">No separate checklist was supplied in this agreement. Read the agreement guidance.</p>;
  return groups.map((group, index) => {
    const remaining = getRemainingGroup(group, completed);
    return <section className="remaining-group" key={`${group.name}-${index}`}>
      <div className="remaining-heading"><h4>Group {group.name}</h4><span className={`status-badge status-${group.reviewRequired ? "review_required" : remaining.complete ? "satisfied" : "not_satisfied"}`}>{group.reviewRequired ? "Confirm options" : remaining.complete ? "Matched" : "Remaining"}</span></div>
      {group.reviewRequired ? <p className="checklist-note">{groupReviewMessage(group)}</p>
        : !remaining.complete && <p className="checklist-note">{group.requiredCount === null ? `Complete ${remaining.remainingCount} remaining requirement${remaining.remainingCount === 1 ? "" : "s"}.` : `Choose ${remaining.remainingCount} more requirement${remaining.remainingCount === 1 ? "" : "s"} below.`}</p>}
      {group.maxPerDepartment !== undefined && <p className="checklist-note">Limit: {group.maxPerDepartment} per department.</p>}
      {group.note && <details className="group-notes"><summary>Group conditions</summary><p>{group.note}</p></details>}
      {!group.reviewRequired && remaining.matchedRequirements.filter(requirement => requirement.apPreparation).map((requirement, i) => <APPreparationCredit key={`${requirement.name}-${i}`} requirement={requirement} />)}
      {(!remaining.complete || group.reviewRequired) && (group.reviewRequired ? group.requirements : remaining.requirements).map((requirement, i) => <RequirementDisplay key={`${requirement.name}-${i}`} requirement={requirement} completedCourses={completed} enrolledCourses={enrolledCourses} compact showDepartment={group.maxPerDepartment !== undefined} />)}
      {!remaining.complete && !group.reviewRequired && remaining.requirements.length === 0 && <p className="checklist-note">Department limits prevent completion. Confirm your options with a counselor.</p>}
    </section>;
  });
}

function SuggestedCourses({ courses }: { courses: CourseCatalogEntry[] }) {
  return <ul className="suggested-courses">{courses.map(course => <li key={course.code}><strong>{course.code}</strong> — {course.title} <span>({course.minUnits === course.maxUnits ? course.minUnits : `${course.minUnits}–${course.maxUnits}`} units)</span>
    {course.requirements.length > 0 && <details><summary>Prerequisites and catalog conditions</summary>{course.requirements.map((requirement, index) => <p key={index}>{requirement.text}</p>)}</details>}
  </li>)}</ul>;
}

export default function GeneratedChecklist({ agreements, completed, enrolledCourses = [], suggestions, remainingUnits }: {
  agreements: AgreementResult[]; completed: string[];
  suggestions: ReturnType<typeof getPatternSuggestions>; remainingUnits: number;
  enrolledCourses?: string[];
}) {
  return <div className="generated-checklist">
    <section className="checklist-section" aria-labelledby="remaining-pattern-heading"><h3 id="remaining-pattern-heading">Finish the UC seven-course pattern</h3>
      <p className="checklist-note">Choose from the examples below. Check prerequisites and approval for your enrollment term.</p>
      {suggestions.every(item => item.remaining === 0) ? <p className="checklist-complete">All seven slots and the subject-area distribution are matched in your estimate.</p> : suggestions.filter(item => item.remaining > 0).map(item => <div className="pattern-next-step" key={item.name}>
        <h4>{item.name}</h4><p>{item.remaining} more {item.remaining === 1 ? "course" : "courses"}{item.areas[0] === "UC-H" ? " · cover at least two subject areas" : ""}.</p>
        {item.courses.length ? <details><summary>View {item.courses.length} example Mt. SAC courses</summary><p className="checklist-note">Alternatives, not a required list. Examples checked for {formatTerm(EXAMPLE_COURSE_TERM)}; confirm your actual term.</p><SuggestedCourses courses={item.courses} /></details> : <p className="checklist-note">No checked examples available. Ask a counselor for options.</p>}
      </div>)}
    </section>
    <section className="checklist-section" aria-labelledby="major-checklist-heading"><h3 id="major-checklist-heading">Major preparation by campus</h3>
      <p className="checklist-note">OR = choose an option. AND = complete all listed courses.</p>
      {agreements.map(result => <article className="campus-plan" key={result.campus}>
        <h3>{result.campus}</h3><p className="campus-major">{result.major}</p>
        {!result.agreement ? <p className="unavailable-plan">{result.message} Major preparation is not evaluated.</p> : <>
          <p className="checklist-note">ASSIST {result.agreement.academicYear}</p>
          <MajorAPReview review={result.agreement.apPreparationReview} />
          {result.agreement.kind === "informational" ? <p className="unavailable-plan">No course checklist in this agreement. Read the guidance below and confirm preparation with the department.</p> : <>
            <h4 className="checklist-category-title">Required for admission</h4><RemainingGroups groups={result.agreement.requiredGroups} completed={completed} enrolledCourses={enrolledCourses} />
            {(result.agreement.majorRequiredGroups?.length ?? 0) > 0 && <details className="preparation-extras"><summary>Additional lower-division major preparation{result.agreement.majorRequiredGroups!.some(group => group.reviewRequired) && " · confirmation needed"}</summary><p className="checklist-note">Some courses may be completed after transfer. Check the agreement.</p><RemainingGroups groups={result.agreement.majorRequiredGroups!} completed={completed} enrolledCourses={enrolledCourses} /></details>}
            {result.agreement.highlyRecommendedGroups.length > 0 && <details className="preparation-extras"><summary>Highly recommended preparation</summary><RemainingGroups groups={result.agreement.highlyRecommendedGroups} completed={completed} enrolledCourses={enrolledCourses} /></details>}
          </>}
          <details className="full-agreement"><summary>View full agreement, completed matches and source notes</summary><MajorPlan agreement={result.agreement} completedCourses={completed} enrolledCourses={enrolledCourses} /></details>
        </>}
      </article>)}
    </section>
    {remainingUnits > 0 && <section className="checklist-section"><h3>Remaining units</h3><p className="checklist-note">{remainingUnits} semester units to reach 60. Courses from this plan can fill that gap; add transferable electives only as needed.</p></section>}
  </div>;
}
