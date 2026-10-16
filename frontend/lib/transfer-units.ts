import type { CourseCatalogEntry } from "./catalog-types";
import { getAPCredit } from "./ap-credit";
import type { APResults } from "./ap-credit";

export const UC_TRANSFER_UNIT_TARGET = 60;

// A course with a unit range needs the units earned on the student's transcript.
export function getEarnedUnits(course: CourseCatalogEntry, enteredUnits?: string): number | null {
  if (course.minUnits === course.maxUnits) return course.minUnits;
  if (enteredUnits === undefined || enteredUnits.trim() === "") return null;
  const units = Number(enteredUnits);
  return Number.isFinite(units) && units >= course.minUnits && units <= course.maxUnits
    ? units : null;
}

export function getTransferUnitProgress(
  courses: CourseCatalogEntry[],
  completedCourses: string[],
  earnedUnits: Record<string, string> = {},
  apResults: APResults = {}
) {
  const catalog = new Map(courses.map(course => [course.code, course]));
  const variableCourses: CourseCatalogEntry[] = [];
  let totalUnits = 0;
  let pendingCount = 0;
  let nonUCCount = 0;
  let unknownCount = 0;

  // Count each selected code once, regardless of how many major requirements it matches.
  for (const code of new Set(completedCourses)) {
    const course = catalog.get(code);
    if (!course) {
      unknownCount++;
      continue;
    }
    if (!course.ucTransferable) {
      nonUCCount++;
      continue;
    }
    if (course.minUnits !== course.maxUnits) variableCourses.push(course);
    const units = getEarnedUnits(course, earnedUnits[code]);
    if (units === null) pendingCount++;
    else totalUnits += units;
  }

  const apCredit = getAPCredit(apResults);
  // Remove floating-point noise when combining catalog and published AP decimals.
  const combinedUnits = Number((totalUnits + apCredit.units).toFixed(6));
  return {
    totalUnits: combinedUnits,
    courseUnits: totalUnits,
    apCredit,
    remainingUnits: Number(Math.max(0, UC_TRANSFER_UNIT_TARGET - combinedUnits).toFixed(6)),
    targetReached: combinedUnits >= UC_TRANSFER_UNIT_TARGET,
    variableCourses,
    pendingCount,
    nonUCCount,
    unknownCount
  };
}
