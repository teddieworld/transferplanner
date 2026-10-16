import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAgreement } from "../lib/agreement-builder";
import type { AgreementRow } from "../lib/agreement-builder";
import { getRequirementStatus, getPreparationStatus, isCategorySatisfied, isGroupSatisfied, isOptionSatisfied } from "../lib/planner";
import type { Requirement } from "../lib/planner";
import type { CourseCatalogEntry } from "../lib/catalog-types";
import { getTransferUnitProgress } from "../lib/transfer-units";
import { AP_EXAMS, getAPCredit, getAPExamUnits } from "../lib/ap-credit";
import { getSevenCourseProgress } from "../lib/seven-course-pattern";
import type { CoursePatternReviews } from "../lib/seven-course-pattern";

function patternReviews(codes: string[]): CoursePatternReviews {
  return Object.fromEntries(codes.map(code => [code, { grade: "C", term: "F", year: "2025" }]));
}

test("seven-course pattern requires grades, completion terms, and at least 3 earned course units", () => {
  const courses = [unitCourse("MATH 180", 2, 5)];
  assert.equal(getSevenCourseProgress(courses, ["MATH 180"], {}, {}, {}).math, 0);
  for (const grade of ["C-", "D", "F", "NP", "W"]) {
    assert.equal(getSevenCourseProgress(courses, ["MATH 180"], { "MATH 180": "4" }, { "MATH 180": { grade, term: "F", year: "2025" } }, {}).math, 0);
  }
  assert.equal(getSevenCourseProgress(courses, ["MATH 180"], { "MATH 180": "2.5" }, patternReviews(["MATH 180"]), {}).math, 0);
  assert.equal(getSevenCourseProgress(courses, ["MATH 180"], { "MATH 180": "3" }, { "MATH 180": { grade: "P", term: "F", year: "2025" } }, {}).math, 1);
  assert.equal(getSevenCourseProgress(courses, ["MATH 180"], { "MATH 180": "4" }, { "MATH 180": { grade: "A", term: "", year: "" } }, {}).pendingCount, 1);
});

test("a complete pattern uses seven distinct approved courses and handles flexible H/B assignments", () => {
  const codes = ["ENGL C1000", "ENGL C1001", "MATH 180", "HIST 3", "HIST 4", "SOC 1", "BIOL 1"];
  const courses = codes.map(code => unitCourse(code, 3));
  const result = getSevenCourseProgress(courses, [...codes, "HIST 3"], {}, patternReviews(codes), {});
  assert.equal(result.complete, true);
  assert.equal(result.english, 2);
  assert.equal(result.math, 1);
  assert.equal(result.breadth, 4);
  assert.ok(result.areaCount >= 2);
  assert.equal(new Set(result.matches.map(m => m.id)).size, 7);
});

test("four breadth courses in one area do not complete the seven-course pattern", () => {
  const codes = ["ENGL C1000", "ENGL C1001", "MATH 180"];
  const courses = codes.map(code => unitCourse(code, 3));
  const ap = { chinese: { score: "3" }, french: { score: "4" }, german: { score: "5" }, italian: { score: "3" } };
  const oneArea = getSevenCourseProgress(courses, codes, {}, patternReviews(codes), ap);
  assert.equal(oneArea.matchedCount, 7);
  assert.equal(oneArea.areaCount, 1);
  assert.equal(oneArea.complete, false);
  const flexible = getSevenCourseProgress(courses, codes, {}, patternReviews(codes), { ...ap, "us-history": { score: "3" } });
  assert.equal(flexible.complete, true);
  assert.equal(flexible.matches.find(m => m.id === "ap:us-history")?.area, "UC-B");
});

test("equivalent English courses and honors versions cannot fill both English slots", () => {
  for (const codes of [["AMLA 1A", "ENGL C1000", "ENGL C1000H"], ["ENGL C1001", "ENGL C1001H"]]) {
    const result = getSevenCourseProgress(codes.map(code => unitCourse(code, 3)), codes, {}, patternReviews(codes), {});
    assert.equal(result.english, 1);
  }
});

test("source two-course and unit-based family limits constrain breadth matches", () => {
  for (const codes of [["HIST 1", "HIST 7", "HIST 8", "PHIL 5"], ["BIOL 1", "BIOL 2", "BTNY 3", "PHIL 5"]]) {
    const result = getSevenCourseProgress(codes.map(code => unitCourse(code, 3)), codes, {}, patternReviews(codes), {});
    assert.equal(result.breadth, 3);
  }
});

test("AP pattern credit respects subject designations, English cap and automatic course exclusions", () => {
  const ap = { "english-language": { score: "3" }, "english-literature": { score: "5" }, "calculus-bc": { score: "2", abSubscore: "3" }, "computer-science-a": { score: "5" } };
  const result = getSevenCourseProgress([], [], {}, {}, ap);
  assert.equal(result.english, 1);
  assert.equal(result.math, 1);
  assert.equal(result.matchedCount, 2);
  assert.equal(result.complete, false);
  assert.equal(getSevenCourseProgress([unitCourse("ENGL C1000", 3)], ["ENGL C1000"], {}, patternReviews(["ENGL C1000"]), { "english-language": { score: "5" } }).matches.filter(match => match.id.startsWith("ap:")).length, 0);
  assert.equal(getSevenCourseProgress([], [], {}, {}, { biology: { score: "2" } }).breadth, 0);
});

test("unknown courses and cleared selections cannot reuse stale pattern reviews", () => {
  const courses = [unitCourse("UNKNOWN", 3), unitCourse("MATH 180", 4, 4, false)];
  const result = getSevenCourseProgress(courses, courses.map(c => c.code), {}, patternReviews(courses.map(c => c.code)), {});
  assert.deepEqual(result.unlisted, ["UNKNOWN"]);
  assert.equal(result.matchedCount, 0);
  assert.equal(getSevenCourseProgress(courses, [], {}, patternReviews(["MATH 180"]), {}).matchedCount, 0);
});

test("AP unit credit depends on valid scores, not just exam selection", () => {
  for (const score of ["", "0", "1", "2", "3.5", "6", "NaN"]) {
    assert.equal(getAPCredit({ statistics: { score } }).units, 0);
  }
  assert.equal(getAPCredit({ statistics: { score: "" } }).pendingCount, 1);
  for (const score of ["3", "4", "5"]) {
    assert.equal(getAPCredit({ statistics: { score }, biology: { score } }).units, 7.9);
  }
  assert.equal(new Set(AP_EXAMS.map(exam => exam.id)).size, AP_EXAMS.length);
  assert.equal(getAPCredit({ precalculus: { score: "5" }, research: { score: "5" }, seminar: { score: "5" } }).units, 0);
});

test("UC shared AP caps prevent English, Art, Calculus and Physics overcounting", () => {
  const cases = [
    ["english-language", "english-literature"],
    ["art-2d", "art-3d", "art-drawing"],
    ["calculus-ab", "calculus-bc"],
    ["physics-1", "physics-2", "physics-c-mechanics", "physics-c-electricity"]
  ];
  for (const ids of cases) {
    const result = getAPCredit(Object.fromEntries(ids.map(id => [id, { score: "5" }])));
    assert.equal(result.units, 5.3, ids.join(", "));
    assert.equal(result.capNotes.length, 1);
  }
  assert.equal(getAPCredit({ "physics-c-mechanics": { score: "3" }, "physics-c-electricity": { score: "4" } }).units, 5.2);
});

test("Calculus BC AB subscore earns fallback credit without duplicating an AB exam", () => {
  const result = { score: "2", abSubscore: "3" };
  assert.equal(getAPCredit({ "calculus-bc": result }).units, 2.6);
  assert.equal(getAPCredit({ "calculus-bc": result, "calculus-ab": { score: "4" } }).units, 2.6);
  assert.equal(getAPCredit({ "calculus-bc": { ...result, score: "3" }, "calculus-ab": { score: "4" } }).units, 5.3);
  assert.equal(getAPCredit({ "calculus-bc": { score: "1", abSubscore: "2" } }).units, 0);
  assert.equal(getAPCredit({ "calculus-bc": { score: "", abSubscore: "5" } }).pendingCount, 1);
  const music = AP_EXAMS.find(exam => exam.id === "music-theory")!;
  assert.equal(getAPExamUnits(music, { score: "2", abSubscore: "5" }), 0);
});

test("AP overlaps can be excluded, and removing results releases shared caps", () => {
  const result = getAPCredit({ "english-language": { score: "4" }, "english-literature": { score: "3" } }, ["english-language"]);
  assert.equal(result.units, 5.3);
  assert.equal(result.excludedCount, 1);
  assert.equal(result.capNotes.length, 0);
  assert.equal(getAPCredit({ biology: { score: "5" } }, ["biology"]).units, 0);
  assert.equal(getAPCredit({}).units, 0);
});

test("AP and coursework combine toward 60 units without decimal display artifacts", () => {
  const catalog = [unitCourse("BASE", 54.7)];
  const result = getTransferUnitProgress(catalog, ["BASE"], {}, { biology: { score: "3" } });
  assert.equal(result.totalUnits, 60);
  assert.equal(result.courseUnits, 54.7);
  assert.equal(result.apCredit.units, 5.3);
  assert.equal(result.targetReached, true);
  assert.equal(result.remainingUnits, 0);
  const excluded = getTransferUnitProgress([unitCourse("BIOL 1", 4)], ["BIOL 1"], {}, { biology: { score: "3" } }, patternReviews(["BIOL 1"]));
  assert.equal(excluded.totalUnits, 4);
  assert.equal(excluded.targetReached, false);
  assert.equal(excluded.remainingUnits, 56);
  const apOnly = getTransferUnitProgress([], [], {}, { biology: { score: "5" }, statistics: { score: "4" } });
  assert.equal(apOnly.totalUnits, 7.9);
  assert.equal(apOnly.remainingUnits, 52.1);
});

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

// Generated plans retain source choices instead of prescribing every alternative.
import { getCreditCourses, getMajorCourses, getRemainingGroup, getPatternSuggestions } from "../lib/transfer-plan";
import type { RequirementGroup } from "../lib/planner";

test("generated remaining groups preserve choose-N, AND/OR, review flags and preparation exceptions", () => {
  const first: Requirement = { name: "First", articulationStatus: "articulated", options: [["A", "B"], ["C"]] };
  const second: Requirement = { name: "Second", articulationStatus: "articulated", options: [["D", "E"]], preparationOptions: [["D"]] };
  const third: Requirement = { name: "Third", articulationStatus: "partial", options: [["F"]] };
  const group: RequirementGroup = { name: "Choose two", requiredCount: 2, requirements: [first, second, third] };
  const result = getRemainingGroup(group, ["A", "D", "F"]);
  assert.equal(result.remainingCount, 1);
  assert.equal(result.complete, false);
  assert.deepEqual(result.requirements, [first, third]);
  assert.deepEqual(result.requirements[0].options, [["A", "B"], ["C"]]);
  assert.equal(getRemainingGroup(group, ["C", "D"]).complete, true);
  assert.equal(getRemainingGroup({ ...group, reviewRequired: true }, ["C", "D"]).complete, false);
});

test("remaining requirements respect department caps and retain unmatched alternatives", () => {
  const requirements: Requirement[] = ["A", "B", "C", "D"].map((code, index) => ({ name: code, options: [[code]], articulationStatus: "articulated", department: index < 3 ? "History" : "Philosophy" }));
  const group: RequirementGroup = { name: "Breadth", requiredCount: 3, maxPerDepartment: 2, requirements };
  const result = getRemainingGroup(group, ["A", "B", "C"]);
  assert.equal(result.complete, false);
  assert.equal(result.remainingCount, 1);
  assert.deepEqual(result.requirements.map(req => req.name), ["D"]);
  assert.equal(getRemainingGroup(group, ["A", "B", "D"]).complete, true);
});

test("unit-credit grades differ from preparation grades and missing grades remain provisional", () => {
  const codes = ["A", "C-", "D+", "D", "D-", "F", "NP", "W", "P", "Missing"];
  const reviews = Object.fromEntries(codes.filter(code => code !== "Missing").map(grade => [grade, { grade, term: "F", year: "2025" }]));
  assert.deepEqual(getCreditCourses([...codes, "A"], reviews), ["A", "C-", "D+", "D", "D-", "P", "Missing"]);
  assert.deepEqual(getMajorCourses(codes, reviews), ["A", "P", "Missing"]);
});

test("pattern suggestions respect AP credit, equivalent courses and low-grade retakes", () => {
  const courses = [unitCourse("ENGL C1000", 3), unitCourse("ENGL C1000H", 3), unitCourse("ENGL C1001", 3), unitCourse("MATH 180", 4), unitCourse("BIOL 1", 4)];
  const reviews = { ...patternReviews(["ENGL C1000"]), "MATH 180": { grade: "F", term: "F", year: "2025" } };
  const suggestions = getPatternSuggestions(courses, ["ENGL C1000", "MATH 180"], {}, reviews, { biology: { score: "3" } });
  assert.equal(suggestions[0].remaining, 1);
  assert.deepEqual(suggestions[0].courses.map(course => course.code), ["ENGL C1001"]);
  assert.deepEqual(suggestions[1].courses.map(course => course.code), ["MATH 180"]);
  assert.equal(suggestions[2].remaining, 3);
  const afterAPMath = getPatternSuggestions(courses, [], {}, {}, { statistics: { score: "3" } });
  assert.equal(afterAPMath[1].remaining, 0);
  assert.equal(afterAPMath[1].courses.length, 0);
});

test("a full single-area breadth set gets replacement choices and completed patterns get none", () => {
  const codes = ["ENGL C1000", "ENGL C1001", "MATH 180"];
  const courses = [...codes.map(code => unitCourse(code, 3)), unitCourse("SOC 1", 3)];
  const ap = { chinese: { score: "3" }, french: { score: "3" }, german: { score: "3" }, italian: { score: "3" } };
  const replacement = getPatternSuggestions(courses, codes, {}, patternReviews(codes), ap);
  assert.equal(replacement[2].remaining, 1);
  assert.deepEqual(replacement[2].courses.map(course => course.code), ["SOC 1"]);
  const completed = getPatternSuggestions(courses, [...codes, "SOC 1"], {}, patternReviews([...codes, "SOC 1"]), ap);
  assert.ok(completed.every(item => item.remaining === 0 && item.courses.length === 0));
});

test("a short set of pattern examples prioritizes a major course over unrelated alternatives", () => {
  const codes = ["MATH 100", "MATH 110", "MATH 120", "MATH 130", "MATH 140", "MATH 150", "MATH 160", "MATH 180", "MATH 181", "MATH 260", "MATH 290"];
  const courses = codes.map(code => unitCourse(code, 4));
  const suggestions = getPatternSuggestions(courses, [], {}, {}, {}, ["MATH 260"]);
  assert.equal(suggestions[1].courses[0].code, "MATH 260");
  assert.ok(suggestions[1].courses.length <= 8);
});

import { getAPOverlap } from "../lib/ap-overlap";

test("AP/course duplicates are excluded from units and pattern and restored when removed", () => {
  const catalog = [unitCourse("BIOL 1", 4), unitCourse("MATH 180", 4)];
  const ap = { biology: { score: "3" } };
  const reviews = patternReviews(["BIOL 1"]);
  const result = getTransferUnitProgress(catalog, ["BIOL 1"], {}, ap, reviews);
  assert.equal(result.apCredit.units, 0);
  assert.equal(result.courseUnits, 4);
  assert.equal(result.apCredit.excludedCount, 1);
  assert.deepEqual(result.apCredit.overlap.excludedExamIds, ["biology"]);
  const pattern = getSevenCourseProgress(catalog, ["BIOL 1"], {}, reviews, ap);
  assert.equal(pattern.breadth, 1);
  assert.deepEqual(pattern.matches.map(match => match.id), ["course:BIOL 1"]);
  assert.deepEqual(pattern.overlap.excludedExamIds, result.apCredit.overlap.excludedExamIds);
  assert.equal(getTransferUnitProgress(catalog, [], {}, ap, reviews).apCredit.units, 5.3);
  assert.equal(getSevenCourseProgress(catalog, [], {}, reviews, ap).matches[0].id, "ap:biology");
  assert.equal(getAPOverlap(ap, catalog, ["MATH 180"], {}, patternReviews(["MATH 180"])).excludedExamIds.length, 0);
});

test("failed courses, non-UC courses, missing grades and variable units cannot silently replace AP", () => {
  const ap = { biology: { score: "5" } };
  const catalog = [unitCourse("BIOL 1", 1, 5)];
  for (const grade of ["", "C-", "D", "F", "NP", "W"]) {
    const reviews = { "BIOL 1": { grade, term: "F", year: "2025" } };
    assert.equal(getAPOverlap(ap, catalog, ["BIOL 1"], { "BIOL 1": "4" }, reviews).excludedExamIds.length, 0);
  }
  const reviews = patternReviews(["BIOL 1"]);
  for (const units of ["", "0", "6", "NaN"]) {
    assert.equal(getAPOverlap(ap, catalog, ["BIOL 1"], { "BIOL 1": units }, reviews).checks[0].status, "review");
  }
  assert.equal(getAPOverlap(ap, catalog, ["BIOL 1"], { "BIOL 1": "4" }, reviews).checks[0].status, "excluded");
  assert.equal(getAPOverlap(ap, [unitCourse("BIOL 1", 4, 4, false)], ["BIOL 1"], {}, reviews).excludedExamIds.length, 0);
  const failed = getTransferUnitProgress([unitCourse("BIOL 1", 4)], ["BIOL 1"], {}, ap, { "BIOL 1": { grade: "F", term: "F", year: "2025" } });
  assert.equal(failed.courseUnits, 0);
  assert.equal(failed.apCredit.units, 5.3);
});

test("BC credit needs the full sequence; AB fallback and score-specific equivalence stay distinct", () => {
  const catalog = [unitCourse("MATH 180", 4), unitCourse("MATH 181", 4)];
  const reviews = patternReviews(["MATH 180", "MATH 181"]);
  const bc = { "calculus-bc": { score: "4" } };
  assert.equal(getAPOverlap(bc, catalog, ["MATH 180"], {}, reviews).checks[0].status, "review");
  assert.equal(getTransferUnitProgress(catalog, ["MATH 180"], {}, bc, reviews).apCredit.units, 5.3);
  assert.deepEqual(getAPOverlap(bc, catalog, ["MATH 180", "MATH 181"], {}, reviews).excludedExamIds, ["calculus-bc"]);
  assert.equal(getAPOverlap({ "calculus-ab": { score: "3" } }, catalog, ["MATH 180"], {}, reviews).checks[0].status, "review");
  assert.equal(getAPOverlap({ "calculus-ab": { score: "4" } }, catalog, ["MATH 180"], {}, reviews).checks[0].status, "excluded");
  assert.equal(getAPOverlap({ "calculus-bc": { score: "3" } }, catalog, ["MATH 180", "MATH 181"], {}, reviews).checks[0].status, "review");
  assert.equal(getAPOverlap({ "calculus-bc": { score: "2", abSubscore: "4" } }, catalog, ["MATH 180"], {}, reviews).checks[0].status, "excluded");
  assert.equal(getAPOverlap({ "calculus-bc": { score: "2", abSubscore: "3" } }, catalog, ["MATH 180"], {}, reviews).checks[0].status, "review");
  assert.equal(getAPOverlap({ "calculus-bc": { score: "2", abSubscore: "2" } }, catalog, ["MATH 180"], {}, reviews).checks.length, 0);
});

test("English sequences, renamed courses and verified honors equivalents are not title guesses", () => {
  const codes = ["ENGL C1000H", "ENGL C1002", "MATH 110H", "BUSC 1B", "BIOL 4"];
  const catalog = codes.map(code => unitCourse(code, 3));
  const reviews = patternReviews(codes);
  const ap = { "english-language": { score: "4" }, "english-literature": { score: "5" }, statistics: { score: "3" }, microeconomics: { score: "4" }, biology: { score: "5" } };
  const partial = getAPOverlap(ap, catalog, ["ENGL C1000H"], {}, reviews);
  assert.equal(partial.checks.find(check => check.examId === "english-language")?.status, "excluded");
  assert.equal(partial.checks.find(check => check.examId === "english-literature")?.status, "review");
  const result = getAPOverlap(ap, catalog, codes, {}, reviews);
  assert.deepEqual(result.excludedExamIds, ["english-language", "english-literature", "microeconomics", "statistics"]);
  assert.equal(result.checks.find(check => check.examId === "biology")?.status, "clear");
  const misleading = [{ ...unitCourse("NOT VERIFIED", 3), title: "Introduction to Psychology" }];
  assert.equal(getAPOverlap({ psychology: { score: "4" } }, misleading, ["NOT VERIFIED"], {}, patternReviews(["NOT VERIFIED"])).excludedExamIds.length, 0);
});

test("unmapped and partial matches remain provisional, never remove AP by a shared UC area", () => {
  const codes = ["PHYS 4A", "CHIN 1"];
  const catalog = codes.map(code => unitCourse(code, 4));
  const ap = { "physics-c-mechanics": { score: "5" }, chinese: { score: "4" } };
  const result = getTransferUnitProgress(catalog, codes, {}, ap, patternReviews(codes));
  assert.equal(result.apCredit.units, 7.9);
  assert.equal(result.apCredit.excludedCount, 0);
  assert.ok(result.apCredit.overlap.checks.every(check => check.status === "review"));
  assert.equal(getAPOverlap({ biology: { score: "2" } }, [unitCourse("BIOL 1", 4)], ["BIOL 1"], {}, patternReviews(["BIOL 1"])).checks.length, 0);
});

test("pattern suggestions do not recommend duplicate equivalents as additional pattern credit", () => {
  const courses = [unitCourse("ENGL C1000", 3), unitCourse("ENGL C1001", 3)];
  const suggestions = getPatternSuggestions(courses, [], {}, {}, { "english-language": { score: "4" } });
  assert.equal(suggestions[0].remaining, 1);
  assert.deepEqual(suggestions[0].courses.map(course => course.code), ["ENGL C1001"]);
});

import { getCourseApproval, getCourseEligibility, completionTerm, termIndex } from "../lib/course-approval";

test("automatic approvals require completion dates and use inclusive starts/exclusive ends", () => {
  const catalog = [unitCourse("MATH 135", 3), unitCourse("ENGL C1000", 4), unitCourse("MATH 260", 3)];
  const check = (code: string, term: string, year: string) => getCourseApproval(code, catalog, [code], { [code]: { grade: "C", term, year } });
  assert.equal(check("MATH 135", "F", "2023").status, "eligible");
  assert.equal(check("MATH 135", "Su", "2026").status, "eligible");
  assert.equal(check("MATH 135", "F", "2026").status, "not_approved");
  assert.equal(check("MATH 135", "S", "2027").status, "not_approved");
  assert.equal(check("ENGL C1000", "F", "2024").status, "review");
  assert.equal(check("ENGL C1000", "F", "2025").status, "eligible");
  assert.equal(check("MATH 260", "F", "2026").status, "eligible");
  assert.equal(check("MATH 260", "", "2025").status, "pending");
  assert.equal(check("MATH 260", "F", "NaN").status, "pending");
  assert.ok(termIndex("W2025")! < termIndex("S2025")!);
  assert.ok(termIndex("S2025")! < termIndex("Su2025")!);
  assert.ok(termIndex("Su2025")! < termIndex("F2025")!);
  assert.equal(completionTerm({ grade: "A", term: "Fall", year: "2025" }), null);
});

test("recorded course-version ends do not silently stay approved under an open area range", () => {
  const catalog = [unitCourse("MATH 180", 4)];
  const result = getCourseApproval("MATH 180", catalog, ["MATH 180"], { "MATH 180": { grade: "A", term: "F", year: "2027" } });
  assert.equal(result.status, "not_approved");
  assert.match(result.messages.join(" "), /course version ends/);
});

test("course ordering checks block later lower-level credit and recompute when dates change", () => {
  for (const [lower, upper] of [["BIOL 1", "BIOL 4"], ["CHEM 20", "CHEM 80"], ["CHEM 40", "CHEM 50"], ["PHYS 1", "PHYS 4A"]]) {
    const catalog = [unitCourse(lower, 4), unitCourse(upper, 4)];
    const completed = [lower, upper];
    const reviews: CoursePatternReviews = { [lower]: { grade: "A", term: "F", year: "2025" }, [upper]: { grade: "C", term: "S", year: "2025" } };
    assert.equal(getCourseApproval(lower, catalog, completed, reviews).status, "not_approved", lower);
    assert.ok(!getSevenCourseProgress(catalog, completed, {}, reviews, {}).matches.some(match => match.courseCode === lower));
    assert.equal(getCourseApproval(lower, catalog, [lower], reviews).status, "eligible", lower);
    reviews[upper] = { grade: "A", term: "S", year: "2026" };
    assert.equal(getCourseApproval(lower, catalog, completed, reviews).status, "eligible", lower);
    reviews[upper] = { grade: "A" };
    assert.equal(getCourseApproval(lower, catalog, completed, reviews).status, "pending", lower);
    reviews[upper] = { grade: "A", term: "F", year: "2025" };
    assert.equal(getCourseApproval(lower, catalog, completed, reviews).status, "review", lower);
  }
});

test("earth-science conditions check all named disciplines rather than just GEOL courses", () => {
  for (const upper of ["ASTR 5", "GEOL 1", "METO 3", "OCEA 10"]) {
    const codes = ["GEOL 8", upper];
    const catalog = codes.map(code => unitCourse(code, 3));
    const reviews: CoursePatternReviews = { "GEOL 8": { grade: "C", term: "F", year: "2025" }, [upper]: { grade: "C", term: "S", year: "2025" } };
    assert.equal(getCourseApproval("GEOL 8", catalog, codes, reviews).status, "not_approved", upper);
    assert.equal(getCourseApproval("GEOL 8", catalog, ["GEOL 8"], reviews).status, "eligible");
  }
});

test("mixed physics series require review while a single series can match automatically", () => {
  const codes = ["PHYS 2AG", "PHYS 2BG", "PHYS 4A", "PHYS 4B", "PHYS 4C"];
  const catalog = codes.map(code => unitCourse(code, 4));
  const reviews = patternReviews(codes);
  assert.equal(getCourseApproval("PHYS 2AG", catalog, ["PHYS 2AG", "PHYS 4A"], reviews).status, "review");
  assert.equal(getSevenCourseProgress(catalog, ["PHYS 2AG", "PHYS 4A"], {}, reviews, {}).breadth, 0);
  assert.equal(getCourseApproval("PHYS 4A", catalog, ["PHYS 4A", "PHYS 4B", "PHYS 4C"], reviews).status, "eligible");
  assert.equal(getSevenCourseProgress(catalog, ["PHYS 4A", "PHYS 4B", "PHYS 4C"], {}, reviews, {}).breadth, 3);
});

test("algebra and precalculus share one pattern slot and duplicate families stay automatic", () => {
  const codes = ["MATH 130", "MATH 160", "ENGL C1000", "ENGL C1000H"];
  const courses = codes.map(code => unitCourse(code, 3));
  const progress = getSevenCourseProgress(courses, codes, {}, patternReviews(codes), {});
  assert.equal(progress.math, 1);
  assert.equal(progress.english, 1);
  assert.ok(progress.approvals.every(approval => approval.status === "eligible"));
});

test("missing source dates and new unsupported conditions never silently auto-approve", () => {
  const mapping = getCourseEligibility("MATH 100");
  const originalNotes = mapping.notes;
  const originalApprovals = mapping.approvals;
  const catalog = [unitCourse("MATH 100", 3)];
  const reviews = patternReviews(["MATH 100"]);
  try {
    mapping.notes = [...originalNotes, "Additional institution-specific approval condition"];
    assert.equal(getCourseApproval("MATH 100", catalog, ["MATH 100"], reviews).status, "review");
    mapping.notes = originalNotes;
    mapping.approvals = originalApprovals.map(approval => ({ ...approval, endTerm: null }));
    assert.equal(getCourseApproval("MATH 100", catalog, ["MATH 100"], reviews).status, "review");
    assert.equal(getSevenCourseProgress(catalog, ["MATH 100"], {}, reviews, {}).math, 0);
  } finally {
    mapping.notes = originalNotes;
    mapping.approvals = originalApprovals;
  }
});
