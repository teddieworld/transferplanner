import type { Requirement, RequirementGroup, MajorAgreement} from "@/lib/planner";

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
  options: [["CSCI 240"]],
  note: "CSCI 240 provides partial coverage of COMPSCI 61B; completing it does not fully satisfy this requirement."
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
  options: [],
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
//group A of required
const requiredGroupA: RequirementGroup = {
  name: "A",
  requirements: [math51Requirement, math52Requirement],
  requiredCount: null
}
//group B of required
const requiredGroupB: RequirementGroup = {
  name: "B",
  requirements: [math54Requirement, math56Requirement],
  requiredCount: 1
};
//group A of highly recommended
const highlyRecommendedGroupA: RequirementGroup = {
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
//objects representing each section: required and highl recommended
export const highlyRecommendedGroups: RequirementGroup[] = [
    highlyRecommendedGroupA
];

//object representing the entire major agreement
export const berkeleyCsAgreement: MajorAgreement = {
  university: "University of California, Berkeley",
  major: "Computer Science, B.A.",
  academicYear: "2026–2027",
  requiredGroups,
  highlyRecommendedGroups
};


