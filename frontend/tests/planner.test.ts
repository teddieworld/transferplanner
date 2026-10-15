import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAgreement } from "../lib/agreement-builder";
import type { AgreementRow } from "../lib/agreement-builder";
import { getRequirementStatus, getPreparationStatus, isCategorySatisfied, isGroupSatisfied, isOptionSatisfied } from "../lib/planner";
import type { Requirement } from "../lib/planner";
import type { CourseCatalogEntry } from "../lib/catalog-types";
import { getTransferUnitProgress } from "../lib/transfer-units";

function unitCourse(code: string, minUnits: number, maxUnits = minUnits, ucTransferable = true): CourseCatalogEntry {
  return { id: 1, code, title: code, minUnits, maxUnits, ucTransferable,
    csuTransferable: true, description: null, requirements: [] };
}

test("UC unit totals include transferable electives and count each selected code once", () => {
  const catalog = [unitCourse("MATH 180", 4), unitCourse("ARTD 20", 3), unitCourse("NON UC", 5, 5, false)];
  const result = getTransferUnitProgress(catalog, ["MATH 180", "MATH 180", "ARTD 20", "NON UC", "UNKNOWN"]);
  assert.equal(result.totalUnits, 7);
  assert.equal(result.remainingUnits, 53);
  assert.equal(result.targetReached, false);
  assert.equal(result.nonUCCount, 1);
  assert.equal(result.unknownCount, 1);
});

test("variable-unit credit requires an earned value within the catalog range", () => {
  const catalog = [unitCourse("DNCE 1", 0.5, 2), unitCourse("MATH 180", 4)];
  for (const input of [undefined, "", " ", "0", "2.5", "-1", "Infinity", "oops"]) {
    const result = getTransferUnitProgress(catalog, ["DNCE 1", "MATH 180"], input === undefined ? {} : { "DNCE 1": input });
    assert.equal(result.totalUnits, 4, String(input));
    assert.equal(result.pendingCount, 1, String(input));
  }
  for (const value of ["0.5", "1.5", "2"]) {
    const result = getTransferUnitProgress(catalog, ["DNCE 1", "MATH 180"], { "DNCE 1": value });
    assert.equal(result.totalUnits, 4 + Number(value));
    assert.equal(result.pendingCount, 0);
  }
  // Fixed-unit catalog values cannot be overridden by stale or arbitrary inputs.
  assert.equal(getTransferUnitProgress(catalog, ["MATH 180"], { "MATH 180": "60" }).totalUnits, 4);
});

test("the 60-unit target handles fractional units and keeps totals above the target", () => {
  const catalog = [unitCourse("BASE", 59.5), unitCourse("EXTRA", 0.5), unitCourse("ELECTIVE", 3)];
  const below = getTransferUnitProgress(catalog, ["BASE"]);
  assert.equal(below.remainingUnits, 0.5);
  assert.equal(below.targetReached, false);
  assert.equal(getTransferUnitProgress(catalog, ["BASE", "EXTRA"]).targetReached, true);
  const above = getTransferUnitProgress(catalog, ["BASE", "EXTRA", "ELECTIVE"]);
  assert.equal(above.totalUnits, 63);
  assert.equal(above.remainingUnits, 0);
  assert.equal(above.targetReached, true);
});

test("removed and cleared courses stop contributing even when earned-unit inputs remain", () => {
  const catalog = [unitCourse("DNCE 1", 0.5, 2), unitCourse("MATH 180", 4)];
  const inputs = { "DNCE 1": "1.5" };
  assert.equal(getTransferUnitProgress(catalog, ["DNCE 1", "MATH 180"], inputs).totalUnits, 5.5);
  const removed = getTransferUnitProgress(catalog, ["MATH 180"], inputs);
  assert.equal(removed.totalUnits, 4);
  assert.deepEqual(removed.variableCourses, []);
  const cleared = getTransferUnitProgress(catalog, [], inputs);
  assert.equal(cleared.totalUnits, 0);
  assert.equal(cleared.remainingUnits, 60);
  assert.equal(cleared.pendingCount, 0);
});

test("unresolved mappings retain adviser review even when every option is checked", () => {
  const row: AgreementRow = {
    groupId: 1, groupName: "A", category: "required", requiredCount: 1,
    rules: { review_required: true, note: "Choose the correct agreement variant." },
    requirementId: 1, requirementName: "A variant-dependent course", articulationStatus: "review_required",
    note: "Adviser review needed", optionId: 1, optionNumber: 1, courseCode: "MATH 180"
  };
  const plan = buildAgreement({ university: "Berkeley", major: "Review example", academicYear: "2026–2027" }, [row]);
  const requirement = plan.requiredGroups[0].requirements[0];
  assert.equal(getRequirementStatus(requirement, ["MATH 180"]), "review_required");
  assert.equal(getPreparationStatus({ ...requirement, preparationOptions: [["MATH 180"]] }, ["MATH 180"]), "review_required");
  assert.equal(isCategorySatisfied(plan.requiredGroups, ["MATH 180"]), false);
});

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

test("course titles enrich single courses, series and preparation without changing matching codes", () => {
  const row: AgreementRow = {
    groupId: 1, groupName: "A", category: "required", requiredCount: null,
    requirementId: 1, requirementName: "MATH 51 AND MATH 52", articulationStatus: "articulated",
    note: null, optionId: 1, optionNumber: 1, courseCode: "MATH 180", courseTitle: "Calculus and Analytic Geometry I"
  };
  const metadata = { university: "Berkeley", major: "Example", academicYear: "2026–2027",
    receivingCourseTitles: { "MATH 51": "Calculus I", "MATH 52": "Calculus II" } };
  const plan = buildAgreement(metadata, [row,
    { ...row, courseCode: "MATH 181", courseTitle: "Calculus and Analytic Geometry II" },
    { ...row, optionKind: "preparation", optionId: 2 },
    { ...row, requirementId: 2, requirementName: "MATH 51", optionId: 3 },
    { ...row, requirementId: 3, requirementName: "Other program requirement", optionId: null, courseCode: null, courseTitle: null }
  ]);
  const [series, single, other] = plan.requiredGroups[0].requirements;
  assert.equal(series.name, "MATH 51 AND MATH 52");
  assert.deepEqual(series.receivingCourses, [{ code: "MATH 51", title: "Calculus I" }, { code: "MATH 52", title: "Calculus II" }]);
  assert.equal(series.optionCourseTitles?.["MATH 180"], "Calculus and Analytic Geometry I");
  assert.deepEqual(series.options, [["MATH 180", "MATH 181"]]);
  assert.deepEqual(series.preparationOptions, [["MATH 180"]]);
  assert.deepEqual(single.receivingCourses, [{ code: "MATH 51", title: "Calculus I" }]);
  assert.equal(other.receivingCourses, undefined);
  assert.equal(other.optionCourseTitles, undefined);
  assert.equal(getRequirementStatus(series, ["MATH 180", "MATH 181"]), "satisfied");
  const withoutTitles = buildAgreement({ ...metadata, receivingCourseTitles: undefined }, [{ ...row, courseTitle: null }]);
  assert.equal(withoutTitles.requiredGroups[0].requirements[0].receivingCourses, undefined);
  assert.equal(withoutTitles.requiredGroups[0].requirements[0].optionCourseTitles, undefined);
});

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
