"use client";

import {isGroupSatisfied, RequirementGroup} from "@/lib/planner";
import { isCategorySatisfied } from "@/lib/planner";
import RequirementDisplay from "./RequirementDisplay";

type MajorPlanProps = {
    completedCourses: string[];
    requiredGroups: RequirementGroup[];
    highlyRecommendedGroups: RequirementGroup[]
};


export default function MajorPlan({
    completedCourses,
    requiredGroups,
    highlyRecommendedGroups
}: MajorPlanProps)
{
    //check for course completions
    const isRequiredCategorySatisfied = isCategorySatisfied(requiredGroups, completedCourses);

    return(
        <div>
            <h2>
              Required
            </h2>
            {requiredGroups.map(group => (
              <div key={group.name}>
                <h3>Group {group.name}</h3>
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
            <h2>
              Highly recommended
            </h2>
            {highlyRecommendedGroups.map(group => (
              <div key={group.name}>
                <h3>Group {group.name}</h3>
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
