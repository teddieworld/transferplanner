import { UC_ELIGIBILITY as snapshot, getCourseEligibility, getCourseApproval } from "./course-approval";
export { UC_ELIGIBILITY, getCourseEligibility } from "./course-approval";
import { AP_EXAMS, getAPExamUnits } from "./ap-credit";
import type { APResults } from "./ap-credit";
import type { CourseCatalogEntry } from "./catalog-types";
import { getEarnedUnits } from "./course-credit";
import { getAPOverlap } from "./ap-overlap";

export type UCArea = "UC-E" | "UC-M" | "UC-H" | "UC-B" | "UC-S";
export type CoursePatternReview = { grade: string; term?: string; year?: string };
export type CoursePatternReviews = Record<string, CoursePatternReview>;
export const UC_AREA_LABELS: Record<UCArea, string> = {
  "UC-E": "English composition", "UC-M": "Math and quantitative reasoning",
  "UC-H": "Arts and humanities", "UC-B": "Social and behavioral sciences", "UC-S": "Physical and biological sciences"
};

// Only the UC admissions AP table's explicit subject designations are included.
const apAreas: Record<string, UCArea[]> = {
  "art-history": ["UC-H"], biology: ["UC-S"], chemistry: ["UC-S"],
  microeconomics: ["UC-B"], macroeconomics: ["UC-B"],
  "english-language": ["UC-E"], "english-literature": ["UC-E", "UC-H"],
  "environmental-science": ["UC-S"], "government-us": ["UC-B"], "government-comparative": ["UC-B"],
  "us-history": ["UC-B", "UC-H"], "european-history": ["UC-B", "UC-H"], "world-history": ["UC-B", "UC-H"],
  "human-geography": ["UC-B"], chinese: ["UC-H"], french: ["UC-H"], german: ["UC-H"], italian: ["UC-H"],
  latin: ["UC-H"], japanese: ["UC-H"], "spanish-language": ["UC-H"], "spanish-literature": ["UC-H"],
  "calculus-ab": ["UC-M"], "calculus-bc": ["UC-M"], "music-theory": ["UC-H"],
  "physics-1": ["UC-S"], "physics-2": ["UC-S"], "physics-c-mechanics": ["UC-S"], "physics-c-electricity": ["UC-S"],
  psychology: ["UC-B"], statistics: ["UC-M"]
};
const passingGrades = new Set(["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "P"]);
export type PatternMatch = { id: string; label: string; area: UCArea; courseCode?: string };
type Candidate = Omit<PatternMatch, "area"> & { areas: UCArea[]; group: string };

export function getSevenCourseProgress(
  courses: CourseCatalogEntry[], completed: string[], earnedUnits: Record<string, string>,
  reviews: CoursePatternReviews, apResults: APResults
) {
  const catalog = new Map(courses.map(course => [course.code, course]));
  const candidates: Candidate[] = [];
  const reviewCourses: CourseCatalogEntry[] = [];
  const unlisted: string[] = [];
  const approvals = [...new Set(completed)].map(code => getCourseApproval(code, courses, completed, reviews));
  let pendingCount = 0;
  for (const code of new Set(completed)) {
    const course = catalog.get(code);
    const mapping = getCourseEligibility(code);
    if (!course || !mapping) { unlisted.push(code); continue; }
    reviewCourses.push(course);
    const review = reviews[code];
    if (review?.grade && !passingGrades.has(review.grade)) continue;
    const approval = approvals.find(item => item.code === code)!;
    if (!review?.grade || approval.status !== "eligible") { pendingCount++; continue; }
    const units = getEarnedUnits(course, earnedUnits[code]);
    if (units === null) { pendingCount++; continue; }
    if (!course.ucTransferable || units < 3 || !passingGrades.has(review.grade)) continue;
    candidates.push({ id: `course:${code}`, label: code, courseCode: code,
      areas: approval.areas, group: `course:${mapping.creditGroup}` });
  }
  const overlap = getAPOverlap(apResults, courses, completed, earnedUnits, reviews);
  for (const exam of AP_EXAMS) {
    const result = apResults[exam.id];
    if (!result || overlap.excludedExamIds.includes(exam.id) || getAPExamUnits(exam, result) === 0 || !apAreas[exam.id]) continue;
    const family = exam.id.startsWith("calculus-") ? "calculus" : exam.bucket ?? exam.id;
    candidates.push({ id: `ap:${exam.id}`, label: `AP ${exam.name}`, areas: apAreas[exam.id], group: `ap:${family}` });
  }

  // A course/exam gets one slot. Search all area assignments instead of greedily
  // assigning dual H/B courses to H and accidentally losing valid area coverage.
  const groups = new Map<string, Candidate[]>();
  for (const candidate of candidates) groups.set(candidate.group, [...(groups.get(candidate.group) ?? []), candidate]);
  const limits = snapshot.limits.filter(limit => candidates.filter(c => c.courseCode && limit.codes.includes(c.courseCode)).length > limit.maxCourses);
  const count = (matches: PatternMatch[], area: UCArea) => matches.filter(match => match.area === area).length;
  const usage = (matches: PatternMatch[], codes: string[]) => matches.filter(match => match.courseCode && codes.includes(match.courseCode)).length;
  const key = (matches: PatternMatch[]) => [
    ...Object.keys(UC_AREA_LABELS).map(area => count(matches, area as UCArea)),
    ...limits.map(limit => usage(matches, limit.codes))
  ].join(",");
  let states = new Map<string, PatternMatch[]>([[key([]), []]]);
  for (const group of groups.values()) {
    const next = new Map(states);
    for (const matches of states.values()) for (const candidate of group) for (const area of candidate.areas) {
      const english = count(matches, "UC-E");
      const math = count(matches, "UC-M");
      if ((area === "UC-E" && english >= 2) || (area === "UC-M" && math >= 1)) continue;
      if (area !== "UC-E" && area !== "UC-M" && matches.length - english - math >= 4) continue;
      if (limits.some(limit => candidate.courseCode && limit.codes.includes(candidate.courseCode) && usage(matches, limit.codes) >= limit.maxCourses)) continue;
      const assigned = [...matches, { id: candidate.id, label: candidate.label, courseCode: candidate.courseCode, area }];
      next.set(key(assigned), assigned);
    }
    states = next;
  }
  const breadthAreas = (matches: PatternMatch[]) => new Set(matches.filter(m => m.area !== "UC-E" && m.area !== "UC-M").map(m => m.area)).size;
  const rank = (matches: PatternMatch[]) => matches.length * 100 + count(matches, "UC-E") * 10 + count(matches, "UC-M") * 5 + Math.min(breadthAreas(matches), 2);
  let matches: PatternMatch[] = [];
  for (const option of states.values()) if (rank(option) > rank(matches)) matches = option;
  const english = count(matches, "UC-E");
  const math = count(matches, "UC-M");
  const breadth = matches.length - english - math;
  const areaCount = breadthAreas(matches);
  return { matches, english, math, breadth, areaCount, matchedCount: matches.length,
    complete: english === 2 && math === 1 && breadth === 4 && areaCount >= 2,
    reviewCourses, unlisted, pendingCount, overlap, approvals };
}
