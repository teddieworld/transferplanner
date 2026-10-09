"use client";

import {isGroupSatisfied, requirementStatusLabels } from "@/lib/planner";
import type {Requirement, RequirementGroup} from "@/lib/planner";
import { getRequirementStatus } from "@/lib/planner";
import { isCategorySatisfied } from "@/lib/planner";

type MajorPlanProps = {
    completedCourses: string[];
};

const math54Requirement: Requirement = {
  name: "MATH 54",
  articulationStatus: "articulated",
  options: [
    ["ENGR 285"],
    ["MATH 285"],
    ["MATH 260", "MATH 290"]
  ]
};

const compsci61BRequirement: Requirement = {
  name: "COMPSCI 61B",
  articulationStatus: "partial",
  options: [["CSCI 240"]]
};

const math51Requirement: Requirement = {
  name: "MATH 51",
  articulationStatus: "articulated",
  options: [["MATH 180"]]
};

const math52Requirement: Requirement = {
  name: "MATH 52",
  articulationStatus: "articulated",
  options: [["MATH 181"]]
};

const math56Requirement: Requirement = {
  name: "MATH 56",
  articulationStatus: "no_course_articulated",
  options: []
};

const compsci61ARequirement: Requirement = {
  name: "COMPSCI 61A",
  articulationStatus: "no_course_articulated",
  options: []
};

const compsci61CRequirement: Requirement = {
  name: "COMPSCI 61C",
  articulationStatus: "no_course_articulated",
  options: []
};

const compsci70Requirement: Requirement = {
  name: "COMPSCI 70",
  articulationStatus: "university_only",
  options: []
};

const requiredGroupA: RequirementGroup = {
  requirements: [math51Requirement, math52Requirement],
  requiredCount: null
}

const requiredGroupB: RequirementGroup = {
  requirements: [math54Requirement, math56Requirement],
  requiredCount: 1
};

const requiredGroups: RequirementGroup[] = [
  requiredGroupA, requiredGroupB
];

export default function MajorPlan({
    completedCourses
}: MajorPlanProps)
{
    //check for course completions
    const math51Status = getRequirementStatus(math51Requirement, completedCourses);
    const math52Status = getRequirementStatus(math52Requirement, completedCourses);
    const requiredGroupAStatus = isGroupSatisfied(requiredGroupA, completedCourses);
    const math54Status = getRequirementStatus(math54Requirement, completedCourses);
    const math56Status = getRequirementStatus(math56Requirement, completedCourses);
    const isRequiredGroupBSatisfied = isGroupSatisfied(requiredGroupB, completedCourses);
    const isRequiredCategorySatisfied = isCategorySatisfied(requiredGroups, completedCourses);
    const compSci61BStatus = getRequirementStatus(compsci61BRequirement, completedCourses);
    const compsci61AStatus = getRequirementStatus(compsci61ARequirement, completedCourses);
    const compsci61CStatus = getRequirementStatus(compsci61CRequirement, completedCourses);
    const compsci70Status = getRequirementStatus(compsci70Requirement, completedCourses);

    return(
        <div>
            <h2>
              Required
            </h2>
            <p>
              MATH 51: {requirementStatusLabels[math51Status]}
            </p>
            <p>
              MATH 52: {requirementStatusLabels[math52Status]}
            </p>
            <p>
              Required Group A: {requiredGroupAStatus ? "Satisfied" : "Not satisfied"}
            </p>
            <p>
              MATH 54: {requirementStatusLabels[math54Status]}
            </p>
            <p>
              MATH 56: {requirementStatusLabels[math56Status]}
            </p>
            <p>
              Required Group B: {isRequiredGroupBSatisfied ? "Satisfied" : "Not satisfied"}
            </p>
            <p>
              Required preparation: {isRequiredCategorySatisfied ? "Satisfied" : "Not satisfied"}
            </p>
            <h2>
              Highly recommended
            </h2>
            <p>
              COMPSCI 61A: {requirementStatusLabels[compsci61AStatus]}
            </p>
            <p>
              COMPSCI 61B: {requirementStatusLabels[compSci61BStatus]}
            </p>
            <p>
              COMPSCI 61C: {requirementStatusLabels[compsci61CStatus]}
            </p>
            <p>
              COMPSCI 70: {requirementStatusLabels[compsci70Status]}
            </p>
        </div>
    )
}
