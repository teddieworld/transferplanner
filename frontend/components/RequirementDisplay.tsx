"use client";

import type { Requirement } from "@/lib/planner";
import {
  getRequirementStatus,
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
        {requirement.name}: {
            requirementStatusLabels[
            getRequirementStatus(requirement, completedCourses)
            ]
        }
        </p>
        {requirement.options.map((option, index) => (
        <p key={index}>
            Option {index + 1}: {option.join(" AND ")} — {
            isOptionSatisfied(option, completedCourses)
                ? "Completed"
                : "Not completed"
            }
        </p>
        ))}
        {requirement.note && (
            <p>
            {requirement.note}
            </p>
        )}
    </div>
  );
}