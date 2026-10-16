import type { CourseCatalogEntry } from "./catalog-types";
import { getPreparationStatus, isGroupSatisfied } from "./planner";
import type { RequirementGroup } from "./planner";
import { getCourseEligibility, getSevenCourseProgress } from "./seven-course-pattern";
import type { CoursePatternReviews, UCArea } from "./seven-course-pattern";
import type { APResults } from "./ap-credit";

// Campus choices can be saved even before their agreements are in our database.
export const UC_CAMPUSES = [
  { id: "berkeley", label: "UC Berkeley", name: "University of California, Berkeley" },
  { id: "davis", label: "UC Davis", name: "University of California, Davis" },
  { id: "irvine", label: "UC Irvine", name: "University of California, Irvine" },
  { id: "los-angeles", label: "UCLA", name: "University of California, Los Angeles" },
  { id: "merced", label: "UC Merced", name: "University of California, Merced" },
  { id: "riverside", label: "UC Riverside", name: "University of California, Riverside" },
  { id: "san-diego", label: "UC San Diego", name: "University of California, San Diego" },
  { id: "santa-barbara", label: "UC Santa Barbara", name: "University of California, Santa Barbara" },
  { id: "santa-cruz", label: "UC Santa Cruz", name: "University of California, Santa Cruz" },
] as const;
export type Campus = typeof UC_CAMPUSES[number];
export type CampusChoice = { major: string; academicYear: string };
export type StudentProfile = { collegeYear: string; entrySeason: string; entryYear: string };

const preparationGrades = new Set(["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "P"]);
// Unit credit and subject preparation have different grade rules. D grades can
// earn UC units; they cannot complete the seven-course pattern. Missing grades
// remain provisional. Campus-specific higher major grade minimums need review.
export function getCreditCourses(completed: string[], reviews: CoursePatternReviews) {
  const unitGrades = new Set([...preparationGrades, "C-", "D+", "D", "D-"]);
  return [...new Set(completed)].filter(code => !reviews[code]?.grade || unitGrades.has(reviews[code].grade));
}
export function getMajorCourses(completed: string[], reviews: CoursePatternReviews) {
  return [...new Set(completed)].filter(code => !reviews[code]?.grade || preparationGrades.has(reviews[code].grade));
}

export function getRemainingGroup(group: RequirementGroup, completed: string[]) {
  const satisfied = group.requirements.filter(req => getPreparationStatus(req, completed) === "satisfied");
  let count = satisfied.length;
  if (group.maxPerDepartment !== undefined) {
    const departments = new Map<string, number>();
    for (const req of satisfied) if (req.department) departments.set(req.department, (departments.get(req.department) ?? 0) + 1);
    count = [...departments.values()].reduce((total, n) => total + Math.min(n, group.maxPerDepartment!), 0);
  }
  return {
    complete: isGroupSatisfied(group, completed),
    remainingCount: Math.max(0, (group.requiredCount ?? group.requirements.length) - count),
    requirements: group.requirements.filter(req => getPreparationStatus(req, completed) !== "satisfied"),
    // Keep completed choices visible when the department cap prevents completion.
    matchedRequirements: satisfied,
  };
}

// Alternatives for one remaining slot, not a promise that taking every displayed
// option together will satisfy all constraints. Re-evaluate after each selection.
export function getPatternSuggestions(
  courses: CourseCatalogEntry[], completed: string[], earnedUnits: Record<string, string>,
  reviews: CoursePatternReviews, apResults: APResults, priorityCodes: string[] = []
) {
  const progress = getSevenCourseProgress(courses, completed, earnedUnits, reviews, apResults);
  const definitions: { name: string; areas: UCArea[]; remaining: number }[] = [
    { name: "English composition", areas: ["UC-E"], remaining: 2 - progress.english },
    { name: "Math and quantitative reasoning", areas: ["UC-M"], remaining: 1 - progress.math },
    { name: "Arts, social sciences and sciences", areas: ["UC-H", "UC-B", "UC-S"], remaining: Math.max(4 - progress.breadth, progress.areaCount < 2 && progress.breadth === 4 ? 1 : 0) },
  ];
  const choices = definitions.map(definition => ({ ...definition, courses: [] as CourseCatalogEntry[] }));
  if (progress.complete) return choices;
  const priority = new Set(priorityCodes);
  const score = (course: CourseCatalogEntry) => (priority.has(course.code) ? 1 : 0)
    + (completed.includes(course.code) && reviews[course.code]?.grade && !preparationGrades.has(reviews[course.code].grade) ? 2 : 0);
  for (const course of [...courses].sort((a, b) => score(b) - score(a))) {
    // Offer a short set of checked examples rather than evaluating hundreds of
    // near-identical alternatives on the browser's main thread.
    if (choices.every(choice => choice.remaining === 0 || choice.courses.length >= 8)) break;
    const mapping = getCourseEligibility(course.code);
    const attemptedWithLowGrade = completed.includes(course.code) && Boolean(reviews[course.code]?.grade) && !preparationGrades.has(reviews[course.code].grade);
    if ((completed.includes(course.code) && !attemptedWithLowGrade) || !course.ucTransferable || course.maxUnits < 3 || !mapping) continue;
    if (!choices.some(choice => choice.remaining > 0 && choice.courses.length < 8 && mapping.areas.some(area => choice.areas.includes(area as UCArea)))) continue;
    const after = getSevenCourseProgress(courses, [...completed, course.code],
      { ...earnedUnits, [course.code]: String(Math.max(3, course.minUnits)) },
      { ...reviews, [course.code]: { grade: "C", approvalConfirmed: true } }, apResults);
    for (const choice of choices) {
      if (choice.remaining === 0 || choice.courses.length >= 8 || !mapping.areas.some(area => choice.areas.includes(area as UCArea))) continue;
      const improves = choice.areas[0] === "UC-E" ? after.english > progress.english
        : choice.areas[0] === "UC-M" ? after.math > progress.math
        : after.breadth > progress.breadth || after.areaCount > progress.areaCount;
      if (improves) choice.courses.push(course);
    }
  }
  return choices;
}
