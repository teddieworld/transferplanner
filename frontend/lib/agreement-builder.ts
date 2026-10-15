import type { MajorAgreement, Requirement, RequirementGroup } from "./planner";

// LEFT JOIN rows retain unmapped requirements and groups with no options.
export type AgreementRow = {
  groupId: number;
  groupName: string;
  category: string;
  requiredCount: number | null;
  requirementId: number | null;
  requirementName: string | null;
  articulationStatus: string | null;
  note: string | null;
  preparationNote?: string | null;
  optionKind?: string | null;
  optionId: number | null;
  optionNumber: number | null;
  courseCode: string | null;
  courseTitle?: string | null;
  department?: string | null;
  rules?: { max_per_department?: number; note?: string; review_required?: boolean };
};

export type AgreementMetadata = Pick<MajorAgreement, "university" | "major" | "academicYear" | "kind" | "notes" | "reviewNotes"> & {
  receivingCourseTitles?: Record<string, string>;
};

export function buildAgreement(metadata: AgreementMetadata, rows: AgreementRow[]): MajorAgreement {
  const { receivingCourseTitles = {}, ...agreementMetadata } = metadata;
  const requiredGroups: RequirementGroup[] = [];
  const highlyRecommendedGroups: RequirementGroup[] = [];
  const majorRequiredGroups: RequirementGroup[] = [];
  const groups = new Map<number, RequirementGroup>();
  const requirements = new Map<number, Requirement>();
  const options = new Map<number, string[]>();

  for (const row of rows) {
    let group = groups.get(row.groupId);
    if (!group) {
      group = { name: row.groupName, requiredCount: row.requiredCount, requirements: [] };
      if (row.rules?.max_per_department !== undefined) {
        if (!Number.isInteger(row.rules.max_per_department) || row.rules.max_per_department < 1) throw new Error("Invalid department limit");
        group.maxPerDepartment = row.rules.max_per_department;
      }
      if (row.rules?.note) group.note = row.rules.note;
      if (row.rules?.review_required) group.reviewRequired = true;
      groups.set(row.groupId, group);
      if (row.category === "required") requiredGroups.push(group);
      else if (row.category === "highly_recommended") highlyRecommendedGroups.push(group);
      else if (row.category === "major_required") majorRequiredGroups.push(group);
      else throw new Error(`Unsupported requirement category: ${row.category}`);
    }
    if (row.requirementId === null) continue;

    let requirement = requirements.get(row.requirementId);
    if (!requirement) {
      const status = row.articulationStatus;
      if (status !== "articulated" && status !== "partial" &&
          status !== "no_course_articulated" && status !== "university_only" && status !== "review_required") {
        throw new Error(`Invalid articulation status for ${row.requirementName}`);
      }
      if (!row.requirementName) throw new Error("Requirement has no name");
      requirement = {
        name: row.requirementName,
        articulationStatus: status,
        options: [],
        ...(row.department ? { department: row.department } : {}),
        ...(row.note ? { note: row.note } : {}),
        ...(row.preparationNote ? { preparationNote: row.preparationNote } : {})
      };
      // Codes remain the matching keys; titles only enrich the displayed label.
      const receivingCourses = row.requirementName.split(" AND ").map(code => ({
        code, ...(receivingCourseTitles[code] ? { title: receivingCourseTitles[code] } : {})
      }));
      if (receivingCourses.some(course => course.title)) requirement.receivingCourses = receivingCourses;
      requirements.set(row.requirementId, requirement);
      group.requirements.push(requirement);
    }
    if (row.optionId === null) continue;

    let option = options.get(row.optionId);
    if (!option) {
      option = [];
      options.set(row.optionId, option);
      const kind = row.optionKind ?? "equivalence";
      if (kind === "equivalence") {
        requirement.options.push(option);
      } else if (kind === "preparation") {
        requirement.preparationOptions ??= [];
        requirement.preparationOptions.push(option);
      } else {
        throw new Error(`Unsupported option kind: ${kind}`);
      }
    }
    if (row.courseCode && !option.includes(row.courseCode)) option.push(row.courseCode);
    if (row.courseCode && row.courseTitle) {
      requirement.optionCourseTitles ??= {};
      requirement.optionCourseTitles[row.courseCode] = row.courseTitle;
    }
  }

  // An incomplete mapping must not silently satisfy an empty AND option.
  for (const option of options.values()) {
    if (option.length === 0) throw new Error("Articulation option has no courses for this college");
  }
  const hasGroups = requiredGroups.length + majorRequiredGroups.length + highlyRecommendedGroups.length > 0;
  if (metadata.kind === "informational" && hasGroups) throw new Error("Informational agreement has course groups");
  if (!hasGroups && metadata.kind !== "informational") throw new Error("Agreement has no course groups");
  return { ...agreementMetadata, requiredGroups, majorRequiredGroups, highlyRecommendedGroups };
}
