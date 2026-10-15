//checks if every course is completed in a articulation option
export function isOptionSatisfied(
  optionCourses: string[],
  completedCourses: string[]
): boolean {//returns a boolean
  return optionCourses.length > 0 && optionCourses.every(course =>
    completedCourses.includes(course)
  );
}

//checks if a requirement is satisfied
//checks each option if it is satisfied
export function isRequirementSatisfied(
  options: string[][],
  completedCourses: string[]
): boolean {
  return options.some(option =>
    isOptionSatisfied(option, completedCourses)
  );
}

//types are similar to classes; create a blueprint for an object containing these values
//each reqirement for a course contains its articulation status and the actual options
export type Requirement = {
    name: string;
    options: string[][];
    preparationOptions?: string[][];
    preparationNote?: string;
    department?: string;
    articulationStatus:
        | "articulated"
        | "partial"
        | "no_course_articulated"
        | "university_only"
    note?: string;
}

//contains the different requirement statuses
export type RequirementStatus =
  | "satisfied"
  | "partial"
  | "not_satisfied"
  | "no_course_articulated"
  | "university_only";

//returns a RequirementStatus
export function getRequirementStatus(
    requirement: Requirement,
    completedCourses: string[]
): RequirementStatus{
    if (requirement.articulationStatus === "no_course_articulated"){
        return "no_course_articulated";
    }
    if (requirement.articulationStatus === "university_only") {
        return "university_only";
    }
    if(!isRequirementSatisfied(requirement.options, completedCourses)){
        return "not_satisfied";
    }
    return requirement.articulationStatus === "partial" ? "partial" : "satisfied";
}

// A reviewed major-preparation exception does not change course equivalence.
export function getPreparationStatus(
  requirement: Requirement,
  completedCourses: string[]
): RequirementStatus {
  if (requirement.preparationOptions === undefined) {
    return getRequirementStatus(requirement, completedCourses);
  }
  return isRequirementSatisfied(requirement.preparationOptions, completedCourses)
    ? "satisfied"
    : "not_satisfied";
}

//returns the labels printed into html
export const requirementStatusLabels: Record<RequirementStatus, string> = {
  satisfied: "Satisfied",
  partial: "Partial",
  not_satisfied: "Not satisfied",
  no_course_articulated: "No course articulated",
  university_only: "University only"
};

//a type for each requirement group
export type RequirementGroup = {
  name: string;
  requirements: Requirement[];
  requiredCount: number | null;
  maxPerDepartment?: number;
  note?: string;
  reviewRequired?: boolean;
};

export function isGroupSatisfied(
    group:RequirementGroup,
    completedCourses: string[]
): boolean{
    if (group.reviewRequired || group.requirements.length === 0) return false;
    const satisfied = group.requirements.filter(requirement => getPreparationStatus(requirement, completedCourses) === "satisfied");
    let satisfiedCount = satisfied.length;
    const departmentLimit = group.maxPerDepartment;
    if (departmentLimit !== undefined) {
      const counts = new Map<string, number>();
      for (const requirement of satisfied) {
        if (!requirement.department) return false;
        counts.set(requirement.department, (counts.get(requirement.department) ?? 0) + 1);
      }
      satisfiedCount = [...counts.values()].reduce((total, count) => total + Math.min(count, departmentLimit), 0);
    }

    const requiredCount = group.requiredCount ?? group.requirements.length;
    //if left side is null, then use right side
    return satisfiedCount >= requiredCount;
}

export function isCategorySatisfied(
  groups: RequirementGroup[],
  completedCourses: string[]
): boolean {
  return groups.length > 0 && groups.every(group =>
    isGroupSatisfied(group, completedCourses)
  );
}

export type MajorAgreement = {
  university: string;
  major: string;
  academicYear: string;
  requiredGroups: RequirementGroup[];
  highlyRecommendedGroups: RequirementGroup[];
  majorRequiredGroups?: RequirementGroup[];
  kind?: "structured" | "informational";
  notes?: string[];
  reviewNotes?: string[];
};
