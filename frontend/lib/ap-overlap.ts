import { AP_EXAMS, AP_SUBJECT_AREAS, getAPExamUnits } from "./ap-credit";
import type { APResults } from "./ap-credit";
import type { CourseCatalogEntry } from "./catalog-types";
import { getEarnedUnits, PREPARATION_GRADES } from "./course-credit";
import type { CoursePatternReviews, UCArea } from "./seven-course-pattern";
import { getCourseApproval } from "./course-approval";
import eligibility from "../data/uc-eligibility-mtsac-2025-2026.json";

export const AP_OVERLAP_SOURCE = "https://catalog.mtsac.edu/registration-policies/academic-policies-requirements/";
export const AP_OVERLAP_CHECKED_ON = "2026-10-15";
export const AP_OVERLAP_REVIEW_NOTICE = "Confirm excluded AP credit with a counselor or UC admissions.";
export const AP_OVERLAP_ALIAS_SOURCES = [
  "https://catalog.mtsac.edu/programs/coursesaz/engl/",
  "https://www.mtsac.edu/art-history/courses.html",
  "https://catalog.mtsac.edu/programs/coursesaz/econ/",
  "https://www.mtsac.edu/math/courses/math110.html",
  "https://www.mtsac.edu/guided-pathways/search/?P=PSYC+C1000",
  "https://www.mtsac.edu/guided-pathways/search/?P=POLS+C1000",
] as const;

// Mt. SAC's 2026–27 AP course-equivalence table supplies content matches, not a
// UC campus award ruling. We keep college units and conservatively exclude the
// entire AP award for a full match or while any overlap check needs review.
// Withholding uncertain units is a planning choice, not a denial of UC credit.
// Outer arrays mean AND; inner arrays are documented renamed-course alternatives.
// No department/title matching, inferred physics equivalence, or guessed partial-unit deductions.
const rules: Record<string, { groups: string[][]; minScore?: number }> = {
  "art-history": { groups: [["ARTH C1100", "ARTH C1100H", "AHIS 4", "AHIS 4H"], ["ARTH C1200", "ARTH C1200H", "AHIS 5", "AHIS 5H"]] },
  biology: { groups: [["BIOL 1"]] },
  "calculus-ab": { groups: [["MATH 180"]], minScore: 4 },
  "calculus-bc": { groups: [["MATH 180"], ["MATH 181"]], minScore: 4 },
  chemistry: { groups: [["CHEM 40"]] },
  chinese: { groups: [["CHIN 1"], ["CHIN 2"]] },
  "computer-science-a": { groups: [["CSCI 145"]] },
  "english-language": { groups: [["ENGL C1000", "ENGL C1000H", "ENGL 1A", "ENGL 1AH"]] },
  "english-literature": { groups: [["ENGL C1000", "ENGL C1000H", "ENGL 1A", "ENGL 1AH"], ["ENGL C1002", "ENGL C1002H", "ENGL 1B", "ENGL 1BH"]] },
  french: { groups: [["FRCH 1"], ["FRCH 2"]] },
  german: { groups: [["GERM 1"], ["GERM 2"]] },
  "government-us": { groups: [["POLS C1000", "POLI 1"]] },
  "human-geography": { groups: [["GEOG 2"]] },
  italian: { groups: [["ITAL 1"], ["ITAL 2"]] },
  japanese: { groups: [["JAPN 1"], ["JAPN 2"]] },
  macroeconomics: { groups: [["ECON C2002", "ECON C2002H", "BUSC 1A", "BUSC 1AH"]] },
  microeconomics: { groups: [["ECON C2001", "ECON C2001H", "BUSC 1B", "BUSC 1BH"]] },
  "music-theory": { groups: [["MUS 110"]] },
  psychology: { groups: [["PSYC C1000", "PSYC 1A"]] },
  "spanish-language": { groups: [["SPAN 1"], ["SPAN 2"]] },
  "spanish-literature": { groups: [["SPAN 3"]] },
  statistics: { groups: [["STAT C1000", "STAT C1000H", "MATH 110", "MATH 110H"]] },
  "us-history": { groups: [["HIST 1"]] },
};

// Additional honors/regular equivalents must already be verified in the ASSIST
// snapshot. Never infer equivalence simply by adding/removing a suffix.
const mappings: Record<string, { creditGroup: string }> = eligibility.courses;
const equivalent = (code: string, expected: string) => code === expected || Boolean(mappings[code] && mappings[expected] && mappings[code].creditGroup === mappings[expected].creditGroup);

export type APOverlapCheck = {
  examId: string; examName: string; status: "excluded" | "review" | "clear";
  courseCodes: string[]; reason: string; message: string;
  patternAreas: UCArea[];
};
export type APOverlapReport = { checks: APOverlapCheck[]; excludedExamIds: string[]; patternExcludedExamIds: string[] };

export function getAPOverlap(
  results: APResults, courses: CourseCatalogEntry[], completed: string[],
  earnedUnits: Record<string, string> = {}, reviews: CoursePatternReviews = {}
): APOverlapReport {
  const selected = new Set(completed);
  // Failed/withdrawn and non-UC courses cannot replace an AP award. Missing or
  // low grades and unresolved variable units produce a review. Review holds AP
  // units out of the total without declaring the college course equivalent.
  const potential = courses.filter(course => selected.has(course.code) && course.ucTransferable
    && reviews[course.code]?.status !== "enrolled"
    && !["F", "NP", "W"].includes(reviews[course.code]?.grade));
  const earned = potential.filter(course => PREPARATION_GRADES.has(reviews[course.code]?.grade)
    && (getEarnedUnits(course, earnedUnits[course.code]) ?? 0) > 0);
  const checks: APOverlapCheck[] = [];
  for (const exam of AP_EXAMS) {
    const result = results[exam.id];
    if (!result || getAPExamUnits(exam, result) === 0) continue;
    let rule = rules[exam.id];
    let score = Number(result.score);
    // A nonqualifying BC score with a qualifying subscore awards AB credit only.
    if (exam.id === "calculus-bc" && score < 3) {
      rule = rules["calculus-ab"];
      score = Number(result.abSubscore);
    }
    const base = { examId: exam.id, examName: exam.name, patternAreas: AP_SUBJECT_AREAS[exam.id] ?? [] };
    const check = (status: APOverlapCheck["status"], courseCodes: string[], reason: string, patternAreas = base.patternAreas): APOverlapCheck => ({
      ...base, status, courseCodes, reason, patternAreas,
      message: status === "review" ? `${reason} AP units excluded. ${AP_OVERLAP_REVIEW_NOTICE}` : reason,
    });
    if (!rule) {
      checks.push(check(potential.length ? "review" : "clear", [], potential.length
        ? "No verified rule to check this exam against your college courses."
        : "No college coursework to compare."));
      continue;
    }
    const matches = potential.filter(course => rule.groups.some(group => group.some(code => equivalent(course.code, code))));
    const fullMatch = rule.groups.every(group => earned.some(course => group.some(code => equivalent(course.code, code))));
    const courseCodes = [...new Set(matches.map(course => course.code))];
    if (fullMatch && score >= (rule.minScore ?? 3)) {
      // Unit duplication does not invalidate the AP exam's subject designation.
      // Replace each AP pattern area only with a qualifying college counterpart;
      // an entered course with missing dates/approval must not erase valid AP credit.
      const coveredAreas = new Set(earned.filter(course => courseCodes.includes(course.code)
        && (getEarnedUnits(course, earnedUnits[course.code]) ?? 0) >= 3).flatMap(course => {
          const approval = getCourseApproval(course.code, courses, completed, reviews);
          return approval.status === "eligible" ? approval.areas : [];
        }));
      const patternAreas = base.patternAreas.filter(area => !coveredAreas.has(area));
      checks.push(check("excluded", courseCodes, `Duplicates ${courseCodes.join(" + ")}. College units counted; AP units excluded.`, patternAreas));
    } else if (matches.length) {
      const reasons: string[] = [];
      const missing = rule.groups.filter(group => !potential.some(course => group.some(code => equivalent(course.code, code))));
      if (missing.length) reasons.push(`Partial overlap with ${courseCodes.join(" + ")}; missing ${missing.map(group => group[0]).join(" + ")}.`);
      const missingGrades = matches.filter(course => !reviews[course.code]?.grade).map(course => course.code);
      if (missingGrades.length) reasons.push(`Add grades for ${missingGrades.join(", ")}.`);
      const lowGrades = matches.filter(course => reviews[course.code]?.grade && !PREPARATION_GRADES.has(reviews[course.code].grade)).map(course => course.code);
      if (lowGrades.length) reasons.push(`Grades below C in ${lowGrades.join(", ")} need an overlap check.`);
      const invalidUnits = matches.filter(course => (getEarnedUnits(course, earnedUnits[course.code]) ?? 0) <= 0).map(course => course.code);
      if (invalidUnits.length) reasons.push(`Enter valid earned units for ${invalidUnits.join(", ")}.`);
      if (score < (rule.minScore ?? 3)) reasons.push(`Score ${score} is below the college's equivalency threshold (${rule.minScore ?? 3}).`);
      checks.push(check("review", courseCodes, reasons.join(" ")));
    } else {
      checks.push(check("clear", [], "No matching college course."));
    }
  }
  return { checks, excludedExamIds: checks.filter(check => check.status !== "clear").map(check => check.examId),
    patternExcludedExamIds: checks.filter(check => check.status === "excluded" && check.patternAreas.length === 0).map(check => check.examId) };
}
