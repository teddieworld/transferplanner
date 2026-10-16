import type { CourseCatalogEntry } from "./catalog-types";
import type { CoursePatternReviews } from "./seven-course-pattern";

export const PREPARATION_GRADES = new Set(["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "P"]);
const UNIT_GRADES = new Set([...PREPARATION_GRADES, "C-", "D+", "D", "D-"]);

export function getEarnedUnits(course: CourseCatalogEntry, enteredUnits?: string): number | null {
  if (course.minUnits === course.maxUnits) return course.minUnits;
  if (enteredUnits === undefined || enteredUnits.trim() === "") return null;
  const units = Number(enteredUnits);
  return Number.isFinite(units) && units >= course.minUnits && units <= course.maxUnits ? units : null;
}

// Missing grades remain provisional. Unit credit and preparation have different rules.
// Enrollment is independent of grade; even a stale grade cannot earn credit.
export function getEnrolledCourses(selected: string[], reviews: CoursePatternReviews) {
  return [...new Set(selected)].filter(code => reviews[code]?.status === "enrolled");
}
export function getCreditCourses(completed: string[], reviews: CoursePatternReviews) {
  return [...new Set(completed)].filter(code => reviews[code]?.status !== "enrolled" && (!reviews[code]?.grade || UNIT_GRADES.has(reviews[code].grade)));
}
export function getMajorCourses(completed: string[], reviews: CoursePatternReviews) {
  return [...new Set(completed)].filter(code => reviews[code]?.status !== "enrolled" && (!reviews[code]?.grade || PREPARATION_GRADES.has(reviews[code].grade)));
}
