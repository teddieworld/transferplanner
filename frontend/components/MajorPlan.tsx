"use client";

import {isGroupSatisfied, MajorAgreement} from "@/lib/planner";
import { isCategorySatisfied } from "@/lib/planner";
import RequirementDisplay from "./RequirementDisplay";

type MajorPlanProps = {
    completedCourses: string[];
    agreement: MajorAgreement;
};


export default function MajorPlan({
    completedCourses,
    agreement
}: MajorPlanProps)
{
    //check for course completions
    const isRequiredCategorySatisfied = isCategorySatisfied(agreement.requiredGroups, completedCourses);

    return(
        <div>
          <h2>
            {agreement.major}
          </h2>
          <p>
            {agreement.university}
          </p>
          <p>
            Academic year: {agreement.academicYear}
          </p>
            <h3>
              Required
            </h3>
            {agreement.requiredGroups.map(group => (
              <div key={group.name}>
                <h4>Group {group.name}</h4>
                <p>
                  {group.requiredCount === null
                    ? "Complete all requirements in this group."
                    : `Complete at least ${group.requiredCount} requirement(s) in this group.`}
                </p>
                {group.requirements.map(requirement => (
                  <RequirementDisplay
                    key={requirement.name}
                    requirement={requirement}
                    completedCourses={completedCourses}
                  />
                ))}
                <p>
                  Group status: {
                    isGroupSatisfied(group, completedCourses)
                      ? "Satisfied"
                      : "Not satisfied"
                  }
                </p>
              </div>
            ))}
            <p>
              Required preparation: {isRequiredCategorySatisfied ? "Satisfied" : "Not satisfied"}
            </p>
            <h3>
              Highly recommended
            </h3>
            {agreement.highlyRecommendedGroups.map(group => (
              <div key={group.name}>
                <h4>Group {group.name}</h4>
                {group.requirements.map(requirement => (
                  <RequirementDisplay
                    key={requirement.name}
                    requirement={requirement}
                    completedCourses={completedCourses}
                  />
                ))}
              </div>
            ))}
        </div>
    )
}
