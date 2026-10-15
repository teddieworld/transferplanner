import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAgreement } from "../lib/agreement-builder";
import type { AgreementRow } from "../lib/agreement-builder";
import { getRequirementStatus, getPreparationStatus, isCategorySatisfied, isGroupSatisfied, isOptionSatisfied } from "../lib/planner";
import type { Requirement } from "../lib/planner";

test("informational agreements and empty admission categories never report satisfied", () => {
  const plan = buildAgreement({ university: "Berkeley", major: "Ancient Civilizations", academicYear: "2026–2027",
    kind: "informational", notes: ["Department review is needed."] }, []);
  assert.equal(plan.kind, "informational");
  assert.equal(isCategorySatisfied(plan.requiredGroups, []), false);
  assert.throws(() => buildAgreement({ university: "Berkeley", major: "Unknown", academicYear: "2026–2027" }, []));
});

test("department limits count a valid subset, and ambiguous groups require review", () => {
  const requirements: Requirement[] = ["A", "B", "C", "D"].map((name, index) => ({
    name, articulationStatus: "articulated", options: [[name]], department: index < 3 ? "History" : "Sociology"
  }));
  const group = { name: "B", requiredCount: 3, maxPerDepartment: 2, requirements };
  assert.equal(isGroupSatisfied(group, ["A", "B", "C"]), false);
  assert.equal(isGroupSatisfied(group, ["A", "B", "D"]), true);
  assert.equal(isGroupSatisfied(group, ["A", "B", "C", "D"]), true);
  assert.equal(isGroupSatisfied({ ...group, reviewRequired: true }, ["A", "B", "C", "D"]), false);
  assert.equal(isGroupSatisfied({ ...group, requirements: requirements.map(r => ({ ...r, department: undefined })) }, ["A", "B", "D"]), false);
});

test("SQL builder separates degree groups and preserves their department rules", () => {
  const row: AgreementRow = {
    groupId: 1, groupName: "B", category: "major_required", requiredCount: 3,
    rules: { max_per_department: 2, note: "Choose across departments" },
    requirementId: 1, requirementName: "HISTORY 7A", articulationStatus: "articulated",
    department: "History", note: null, optionId: 1, optionNumber: 1, courseCode: "HIST C1001"
  };
  const plan = buildAgreement({ university: "Berkeley", major: "American Studies", academicYear: "2026–2027" }, [row]);
  assert.equal(plan.requiredGroups.length, 0);
  assert.equal(plan.majorRequiredGroups?.[0].maxPerDepartment, 2);
  assert.equal(plan.majorRequiredGroups?.[0].requirements[0].department, "History");
  assert.equal(plan.majorRequiredGroups?.[0].note, "Choose across departments");
});

const math54: Requirement = {
  name: "MATH 54", articulationStatus: "articulated",
  options: [["ENGR 285"], ["MATH 285"], ["MATH 260", "MATH 290"]]
};

test("reviewed CS preparation accepts linear algebra without changing equivalence", () => {
  const requirement: Requirement = {
    ...math54,
    preparationOptions: [["ENGR 285"], ["MATH 285"], ["MATH 260"]]
  };
  assert.equal(getRequirementStatus(requirement, ["MATH 260"]), "not_satisfied");
  assert.equal(getPreparationStatus(requirement, ["MATH 260"]), "satisfied");
  assert.equal(getPreparationStatus(math54, ["MATH 260"]), "not_satisfied");
  assert.equal(getPreparationStatus(requirement, ["MATH 290"]), "not_satisfied");
  assert.equal(getRequirementStatus(requirement, ["MATH 260", "MATH 290"]), "satisfied");
  assert.equal(getPreparationStatus(requirement, ["MATH 260", "MATH 290"]), "satisfied");
  const groups = [
    { name: "A", requiredCount: null, requirements: [
      { name: "MATH 51", articulationStatus: "articulated" as const, options: [["MATH 180"]] },
      { name: "MATH 52", articulationStatus: "articulated" as const, options: [["MATH 181"]] }
    ] },
    { name: "B", requiredCount: 1, requirements: [requirement] }
  ];
  assert.equal(isCategorySatisfied(groups, ["MATH 180", "MATH 181", "MATH 260"]), true);
  assert.equal(isCategorySatisfied(groups, ["MATH 180", "MATH 181", "MATH 290"]), false);
});

test("SQL builder keeps preparation and equivalence option numbers separate", () => {
  const row: AgreementRow = {
    groupId: 1, groupName: "B", category: "required", requiredCount: 1,
    requirementId: 1, requirementName: "MATH 54", articulationStatus: "articulated",
    note: null, preparationNote: "Reviewed CS exception", optionKind: "equivalence",
    optionId: 1, optionNumber: 1, courseCode: "MATH 260"
  };
  const plan = buildAgreement({ university: "Berkeley", major: "CS", academicYear: "2026–2027" }, [
    row, { ...row, courseCode: "MATH 290" },
    { ...row, optionId: 2, optionKind: "preparation", courseCode: "MATH 260" }
  ]);
  const requirement = plan.requiredGroups[0].requirements[0];
  assert.deepEqual(requirement.options, [["MATH 260", "MATH 290"]]);
  assert.deepEqual(requirement.preparationOptions, [["MATH 260"]]);
  assert.equal(requirement.preparationNote, "Reviewed CS exception");
  assert.equal(getRequirementStatus(requirement, ["MATH 260"]), "not_satisfied");
  assert.equal(isGroupSatisfied(plan.requiredGroups[0], ["MATH 260"]), true);
});

test("MATH 54 preserves OR between alternatives and AND within the pair", () => {
  for (const courses of [["ENGR 285"], ["MATH 285"], ["MATH 260", "MATH 290"]]) {
    assert.equal(getRequirementStatus(math54, courses), "satisfied");
  }
  for (const courses of [[], ["MATH 260"], ["MATH 290"], ["CSCI 240"]]) {
    assert.equal(getRequirementStatus(math54, courses), "not_satisfied");
  }
  assert.equal(isOptionSatisfied([], []), false);
});

test("partial and unmapped requirements never count as fully satisfied", () => {
  const partial: Requirement = { name: "COMPSCI 61B", articulationStatus: "partial", options: [["CSCI 240"]] };
  assert.equal(getRequirementStatus(partial, []), "not_satisfied");
  assert.equal(getRequirementStatus(partial, ["CSCI 240"]), "partial");
  assert.equal(isGroupSatisfied({ name: "A", requiredCount: 1, requirements: [partial] }, ["CSCI 240"]), false);
  for (const status of ["no_course_articulated", "university_only"] as const) {
    const requirement: Requirement = { name: "Unmapped", articulationStatus: status, options: [] };
    assert.equal(getRequirementStatus(requirement, ["CSCI 240"]), status);
    assert.equal(isGroupSatisfied({ name: "B", requiredCount: 1, requirements: [requirement] }, ["CSCI 240"]), false);
  }
});

test("required category needs both groups and is independent of recommendations", () => {
  const groups = [
    { name: "A", requiredCount: null, requirements: [
      { name: "MATH 51", articulationStatus: "articulated" as const, options: [["MATH 180"]] },
      { name: "MATH 52", articulationStatus: "articulated" as const, options: [["MATH 181"]] }
    ] },
    { name: "B", requiredCount: 1, requirements: [math54,
      { name: "MATH 56", articulationStatus: "no_course_articulated" as const, options: [] }
    ] }
  ];
  assert.equal(isCategorySatisfied(groups, ["MATH 180", "MATH 181"]), false);
  assert.equal(isCategorySatisfied(groups, ["MATH 180", "ENGR 285"]), false);
  assert.equal(isCategorySatisfied(groups, ["MATH 180", "MATH 181", "ENGR 285"]), true);
  assert.equal(isCategorySatisfied(groups, ["MATH 180", "MATH 181", "ENGR 285", "CSCI 240"]), true);
});

test("SQL rows retain distinct categories, empty mappings, notes, and paired courses", () => {
  const row: AgreementRow = {
    groupId: 1, groupName: "A", category: "required", requiredCount: 1,
    requirementId: 1, requirementName: "MATH 54", articulationStatus: "articulated",
    note: null, optionId: 1, optionNumber: 1, courseCode: "MATH 260"
  };
  const rows: AgreementRow[] = [
    row,
    { ...row, courseCode: "MATH 290" },
    { ...row, courseCode: "MATH 290" },
    { ...row, requirementId: 2, requirementName: "MATH 56", articulationStatus: "no_course_articulated",
      optionId: null, optionNumber: null, courseCode: null },
    { ...row, groupId: 2, category: "highly_recommended", requiredCount: null,
      requirementId: 3, requirementName: "COMPSCI 61B", articulationStatus: "partial",
      note: "Additional university coursework needed", optionId: 2, courseCode: "CSCI 240" },
    { ...row, groupId: 2, category: "highly_recommended", requiredCount: null,
      requirementId: 4, requirementName: "COMPSCI 70", articulationStatus: "university_only",
      note: "Take after transfer", optionId: null, optionNumber: null, courseCode: null }
  ];
  const metadata = { university: "Berkeley", major: "CS", academicYear: "2026–2027" };
  const plan = buildAgreement(metadata, rows);
  assert.equal(plan.requiredGroups.length, 1);
  assert.equal(plan.highlyRecommendedGroups.length, 1);
  assert.deepEqual(plan.requiredGroups[0].requirements[0].options, [["MATH 260", "MATH 290"]]);
  assert.deepEqual(plan.requiredGroups[0].requirements[1].options, []);
  assert.equal(plan.highlyRecommendedGroups[0].requirements[1].note, "Take after transfer");
  assert.equal(isCategorySatisfied(plan.requiredGroups, ["MATH 260"]), false);
  assert.equal(isCategorySatisfied(plan.requiredGroups, ["MATH 260", "MATH 290"]), true);
  assert.throws(() => buildAgreement(metadata, [{ ...row, courseCode: null }]), /no courses/);
  assert.throws(() => buildAgreement(metadata, [{ ...row, articulationStatus: "invalid" }]), /Invalid articulation/);
});
