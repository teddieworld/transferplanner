//checks if every course is completed in a articulation option
export function isOptionSatisfied(
  optionCourses: string[],
  completedCourses: string[]
): boolean {//returns a boolean
  return optionCourses.every(course =>
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
    articulationStatus:
        | "articulated"
        | "partial"
        | "no_course_articulated"
        | "university_only"
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
};

export function isGroupSatisfied(
    group:RequirementGroup,
    completedCourses: string[]
): boolean{
    const satisfiedCount = group.requirements.filter(requirement => getRequirementStatus(requirement, completedCourses) === "satisfied").length;

    const requiredCount = group.requiredCount ?? group.requirements.length;
    //if left side is null, then use right side
    return satisfiedCount >= requiredCount;
}

export function isCategorySatisfied(
  groups: RequirementGroup[],
  completedCourses: string[]
): boolean {
  return groups.every(group =>
    isGroupSatisfied(group, completedCourses)
  );
}
