"use client";

import type { Requirement } from "@/lib/planner";
import {
  getRequirementStatus,
  getPreparationStatus,
  isOptionSatisfied,
  requirementStatusLabels
} from "@/lib/planner";

type RequirementDisplayProps = {
    requirement: Requirement;
    completedCourses: string[];
};

export default function RequirementDisplay({
  requirement,
  completedCourses
}: RequirementDisplayProps) {
  return (
    <div>
        <p>
        {requirement.name}{requirement.preparationOptions ? " — Course equivalence" : ""}: {
            requirementStatusLabels[
            getRequirementStatus(requirement, completedCourses)
            ]
        }
        </p>
        {requirement.options.map((option, index) => (
        <p key={index}>
            {requirement.preparationOptions ? "Equivalence option" : "Option"} {index + 1}: {option.join(" AND ")} — {
            isOptionSatisfied(option, completedCourses)
                ? "Completed"
                : "Not completed"
            }
        </p>
        ))}
        {requirement.preparationOptions && (
          <div>
            <p>
              Major preparation: {requirementStatusLabels[getPreparationStatus(requirement, completedCourses)]}
            </p>
            {requirement.preparationOptions.map((option, index) => (
              <p key={index}>
                Preparation option {index + 1}: {option.join(" AND ")} — {
                  isOptionSatisfied(option, completedCourses) ? "Completed" : "Not completed"
                }
              </p>
            ))}
            {requirement.preparationNote && <p>{requirement.preparationNote}</p>}
          </div>
        )}
        {requirement.note && (
            <p>
            {requirement.note}
            </p>
        )}
    </div>
  );
}
