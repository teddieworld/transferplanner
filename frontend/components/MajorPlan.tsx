"use client";

import { isCategorySatisfied, isGroupSatisfied } from "@/lib/planner";
import type { MajorAgreement, RequirementGroup } from "@/lib/planner";
import RequirementDisplay from "./RequirementDisplay";

type MajorPlanProps = {
  completedCourses: string[];
  agreement: MajorAgreement;
};

function Groups({ groups, completedCourses }: { groups: RequirementGroup[]; completedCourses: string[] }) {
  return groups.map(group => (
    <div key={group.name}>
      <h4>Group {group.name}</h4>
      <p>{group.reviewRequired ? "Completion rules for this group need adviser review." : group.requiredCount === null
        ? "Complete all requirements in this group."
        : `Complete at least ${group.requiredCount} requirement(s) in this group.`}</p>
      {group.maxPerDepartment !== undefined && <p>Count no more than {group.maxPerDepartment} courses from any one Berkeley department.</p>}
      {group.note && <p style={{ whiteSpace: "pre-wrap" }}>{group.note}</p>}
      {group.requirements.map(requirement => (
        <RequirementDisplay key={requirement.name} requirement={requirement} completedCourses={completedCourses} />
      ))}
      <p>Group status: {group.reviewRequired ? "Needs adviser review"
        : isGroupSatisfied(group, completedCourses) ? "Satisfied" : "Not satisfied"}</p>
    </div>
  ));
}

export default function MajorPlan({ completedCourses, agreement }: MajorPlanProps) {
  const informational = agreement.kind === "informational";
  const degreeGroups = agreement.majorRequiredGroups ?? [];
  return (
    <div>
      <h2>{agreement.major}</h2>
      <p>{agreement.university}</p>
      <p>Academic year: {agreement.academicYear}</p>
      {informational ? (
        <p>This agreement provides guidance without structured course articulations. Review the notes and consult the department; a preparation completion status cannot be calculated.</p>
      ) : (
        <>
          <h3>Required for admission</h3>
          {agreement.requiredGroups.length > 0 ? (
            <>
              <Groups groups={agreement.requiredGroups} completedCourses={completedCourses} />
              <p>Required course preparation: {isCategorySatisfied(agreement.requiredGroups, completedCourses) ? "Satisfied" : "Not satisfied"}</p>
              <p>This checks the listed course mappings. Review agreement notes for grades, deadlines, and other conditions.</p>
            </>
          ) : <p>No separate course-based admission checklist is specified here. Review the degree requirements and agreement notes.</p>}
          {degreeGroups.length > 0 && (
            <>
              <h3>Lower-division major requirements</h3>
              <p>These degree requirements are separate from admission requirements. Some courses may be completed after transfer.</p>
              <Groups groups={degreeGroups} completedCourses={completedCourses} />
            </>
          )}
          {agreement.highlyRecommendedGroups.length > 0 && (
            <>
              <h3>Highly recommended</h3>
              <Groups groups={agreement.highlyRecommendedGroups} completedCourses={completedCourses} />
            </>
          )}
        </>
      )}
      {((agreement.notes?.length ?? 0) > 0 || (agreement.reviewNotes?.length ?? 0) > 0) && (
        <details open={informational}>
          <summary>Agreement notes and review items</summary>
          {agreement.reviewNotes?.map((note, index) => <p key={`review-${index}`}>{note}</p>)}
          {agreement.notes?.map((note, index) => <p key={`source-${index}`} style={{ whiteSpace: "pre-wrap" }}>{note}</p>)}
        </details>
      )}
    </div>
  );
}
