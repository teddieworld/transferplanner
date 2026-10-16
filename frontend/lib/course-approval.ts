import snapshot from "../data/uc-eligibility-mtsac-2025-2026.json";
import type { CourseCatalogEntry } from "./catalog-types";
import type { CoursePatternReviews, UCArea } from "./seven-course-pattern";

export const UC_ELIGIBILITY = snapshot;
export const ASSIST_TERM_SOURCE = "https://resource.assist.org/Portals/0/PDFs/begin_and_end_terms_in_ASSIST.pdf?ver=2020-06-10-125429-350";
export type CourseEligibility = {
  areas: string[]; title: string; notes: string[]; creditGroup: string;
  courseBeginTerm: string | null; courseEndTerm: string | null;
  approvals: { area: string; beginTerm: string | null; endTerm: string | null }[];
};
const mappings: Record<string, CourseEligibility> = snapshot.courses;
export function getCourseEligibility(code: string) { return mappings[code]; }

export const COURSE_TERMS = [{ value: "W", label: "Winter" }, { value: "S", label: "Spring" }, { value: "Su", label: "Summer" }, { value: "F", label: "Fall" }] as const;
export function termIndex(term: string | null | undefined): number | null {
  const match = /^(W|S|Su|F)(\d{4})$/.exec(term ?? "");
  if (!match || Number(match[2]) < 1900 || Number(match[2]) > 2100) return null;
  return Number(match[2]) * 4 + ["W", "S", "Su", "F"].indexOf(match[1]);
}
export function completionTerm(record: CoursePatternReviews[string] | undefined): string | null {
  const term = `${record?.term ?? ""}${record?.year ?? ""}`;
  return termIndex(term) === null ? null : term;
}
export function formatTerm(term: string): string {
  const match = /^(W|S|Su|F)(\d{4})$/.exec(term);
  return match ? `${COURSE_TERMS.find(item => item.value === match[1])!.label} ${match[2]}` : term;
}
// Future checklist options are examples at the source check date, not a scheduled
// enrollment term. They must be rechecked for the student's actual future term.
const checkedMonth = Number(snapshot.checkedOn.slice(5, 7));
export const EXAMPLE_COURSE_TERM = `${checkedMonth === 1 ? "W" : checkedMonth <= 5 ? "S" : checkedMonth <= 8 ? "Su" : "F"}${snapshot.checkedOn.slice(0, 4)}`;

export type CourseApproval = {
  code: string; status: "eligible" | "pending" | "not_approved" | "review" | "in_progress";
  areas: UCArea[]; messages: string[];
};
const codesIn = (text: string): string[] => text.match(/\b[A-Z]{2,5}\s+[A-Z]?\d+[A-Z0-9]*\b/g) ?? [];
const normalized = (note: string) => note.replace(/\s+/g, " ").trim();

export function getCourseApproval(
  code: string, catalog: CourseCatalogEntry[], completed: string[], reviews: CoursePatternReviews
): CourseApproval {
  const course = catalog.find(item => item.code === code);
  const mapping = getCourseEligibility(code);
  const result = (status: CourseApproval["status"], messages: string[], areas: UCArea[] = []): CourseApproval => ({ code, status, messages, areas });
  if (reviews[code]?.status === "enrolled") return result("in_progress", ["Enter a final grade after completing this course."]);
  if (!course || !mapping) return result("review", ["No verified seven-course-pattern area for this course."]);
  if (!course.ucTransferable) return result("not_approved", ["Not listed as UC transferable."]);
  const term = completionTerm(reviews[code]);
  if (!term) return result("pending", ["Add the completion term and year."]);
  const index = termIndex(term)!;
  const courseEnd = mapping.courseEndTerm === "" ? Infinity : termIndex(mapping.courseEndTerm);
  if (courseEnd !== null && index >= courseEnd) return result("not_approved", [`This course version ends before ${formatTerm(mapping.courseEndTerm!)}. Check the newer version on ASSIST.`]);
  const courseStart = mapping.courseBeginTerm === "" ? -Infinity : termIndex(mapping.courseBeginTerm);
  if (courseStart === null || courseEnd === null) return result("review", ["Course approval dates are missing. Confirm your course term on ASSIST."]);
  if (index < courseStart) return result("review", [`Your course predates this record (${formatTerm(mapping.courseBeginTerm!)}). Confirm the older course on ASSIST.`]);
  const areas = new Set<UCArea>();
  let unknownDates = false;
  for (const approval of mapping.approvals) {
    // ASSIST begin terms are inclusive; end terms are exclusive. An explicit
    // blank end is open-ended, not the API's artificial 2070 date. A missing
    // field is unknown, never silently interpreted as an open interval.
    const begin = approval.beginTerm === "" ? mapping.courseBeginTerm : approval.beginTerm;
    if (begin === null || approval.endTerm === null) { unknownDates = true; continue; }
    const start = begin === "" ? -Infinity : termIndex(begin);
    const end = approval.endTerm === "" ? Infinity : termIndex(approval.endTerm);
    if (start === null || end === null) { unknownDates = true; continue; }
    if (index >= start && index < end) areas.add(approval.area as UCArea);
  }
  if (!areas.size) return result(unknownDates ? "review" : "not_approved", [unknownDates ? "Approval dates are incomplete. Confirm your course term on ASSIST." : `No recorded pattern approval for ${formatTerm(term)}. Check ASSIST.`]);

  const blocked: string[] = [];
  const pending: string[] = [];
  const reviewMessages: string[] = [];
  const checked: string[] = [];
  const selected = [...new Set(completed)].filter(other => reviews[other]?.status !== "enrolled");
  function checkOrder(blockers: string[]) {
    for (const blocker of blockers.filter(other => selected.includes(other) && other !== code)) {
      const otherTerm = completionTerm(reviews[blocker]);
      if (!otherTerm) { pending.push(`Add ${blocker}'s completion term and year to check course order.`); continue; }
      const otherIndex = termIndex(otherTerm)!;
      if (otherIndex < index) blocked.push(`${code} was taken after ${blocker} (${formatTerm(otherTerm)}); ASSIST excludes credit in this order.`);
      else if (otherIndex === index) reviewMessages.push(`${code} and ${blocker} are in the same term. Ask a counselor to confirm which came first.`);
    }
  }
  for (const raw of mapping.notes) {
    const note = normalized(raw);
    if (/maximum credit,?\s*\d+\s*(course|unit)s?/i.test(note) || /limited to a single course with a maximum of 5 semester/i.test(note)) {
      checked.push("Shared course-family limits are applied automatically when matching the pattern.");
      continue;
    }
    const ordered = /^No credit for (.+?) if taken after (.+)$/i.exec(note);
    if (ordered) {
      if (codesIn(ordered[1]).includes(code)) checkOrder(codesIn(ordered[2]));
      checked.push("Course-order restrictions checked against the entered course history.");
      continue;
    }
    if (note === "No credit if taken after a college level course in Astronomy, Geology, Meteorology or Oceanography") {
      // Prefix names come directly from this ASSIST response. Only catalog
      // courses marked CSU/UC transferable are classified as college level.
      const related = catalog.filter(other => selected.includes(other.code) && ["ASTR", "GEOL", "METO", "OCEA"].includes(other.code.split(" ")[0])
        && mappings[other.code]?.creditGroup !== mapping.creditGroup);
      checkOrder(related.filter(other => other.ucTransferable || other.csuTransferable).map(other => other.code));
      if (related.some(other => !other.ucTransferable && !other.csuTransferable)) reviewMessages.push("Another earth-science course may limit credit. Ask a counselor to check its level.");
      checked.push("Earth-science course ordering checked against entered college-level courses.");
      continue;
    }
    if (note === "Credit for either ENGR 285 or MATH 285 or MATH 260 and MATH 290" && mapping.areas.every(area => area === "UC-M")) {
      checked.push("Alternative math credit paths are limited by the single UC-M pattern slot.");
      continue;
    }
    if (note === "PHYS 2AG, PHYS 2BG or PHYS 4A, PHYS 4B, PHYS 4C combined: maximum credit, 1 series - deduct credit for duplication of topics") {
      const first = selected.some(other => ["PHYS 2AG", "PHYS 2BG"].includes(other));
      const second = selected.some(other => ["PHYS 4A", "PHYS 4B", "PHYS 4C"].includes(other));
      if (first && second) reviewMessages.push("Both physics series are entered. Ask a counselor to check duplicate topics before counting credit.");
      else checked.push("Only one physics series is entered; the cross-series duplication restriction is not triggered.");
      continue;
    }
    reviewMessages.push(`Ask a counselor to confirm this condition: ${raw}`);
  }
  if (blocked.length) return result("not_approved", [...new Set(blocked)]);
  if (pending.length) return result("pending", [...new Set(pending)]);
  if (reviewMessages.length || unknownDates) return result("review", [...new Set([...reviewMessages, ...(unknownDates ? ["Some approval dates are missing. Confirm your course term on ASSIST."] : [])])]);
  return result("eligible", [`Recorded ${[...areas].join(" / ")} approval covers ${formatTerm(term)}.`, ...new Set(checked)], [...areas]);
}
