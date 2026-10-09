import type { Requirement, RequirementGroup } from "@/lib/planner";

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
  name: "A",
  requirements: [math51Requirement, math52Requirement],
  requiredCount: null
}

const requiredGroupB: RequirementGroup = {
  name: "B",
  requirements: [math54Requirement, math56Requirement],
  requiredCount: 1
};

export const highlyRecommendedGroupA: RequirementGroup = {
  name: "A",
  requirements: [
    compsci61ARequirement,
    compsci61BRequirement,
    compsci61CRequirement,
    compsci70Requirement
  ],
  requiredCount: null
};


export const requiredGroups: RequirementGroup[] = [
  requiredGroupA, requiredGroupB
];

export const highlyRecommendedGroups: RequirementGroup[] = [
    highlyRecommendedGroupA
];


