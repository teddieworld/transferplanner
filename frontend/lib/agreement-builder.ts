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
  optionId: number | null;
  optionNumber: number | null;
  courseCode: string | null;
};

type AgreementMetadata = Pick<MajorAgreement, "university" | "major" | "academicYear">;

export function buildAgreement(metadata: AgreementMetadata, rows: AgreementRow[]): MajorAgreement {
  const requiredGroups: RequirementGroup[] = [];
  const highlyRecommendedGroups: RequirementGroup[] = [];
  const groups = new Map<number, RequirementGroup>();
  const requirements = new Map<number, Requirement>();
  const options = new Map<number, string[]>();

  for (const row of rows) {
    let group = groups.get(row.groupId);
    if (!group) {
      group = { name: row.groupName, requiredCount: row.requiredCount, requirements: [] };
      groups.set(row.groupId, group);
      if (row.category === "required") requiredGroups.push(group);
      else if (row.category === "highly_recommended") highlyRecommendedGroups.push(group);
      else throw new Error(`Unsupported requirement category: ${row.category}`);
    }
    if (row.requirementId === null) continue;

    let requirement = requirements.get(row.requirementId);
    if (!requirement) {
      const status = row.articulationStatus;
      if (status !== "articulated" && status !== "partial" &&
          status !== "no_course_articulated" && status !== "university_only") {
        throw new Error(`Invalid articulation status for ${row.requirementName}`);
      }
      if (!row.requirementName) throw new Error("Requirement has no name");
      requirement = {
        name: row.requirementName,
        articulationStatus: status,
        options: [],
        ...(row.note ? { note: row.note } : {})
      };
      requirements.set(row.requirementId, requirement);
      group.requirements.push(requirement);
    }
    if (row.optionId === null) continue;

    let option = options.get(row.optionId);
    if (!option) {
      option = [];
      options.set(row.optionId, option);
      requirement.options.push(option);
    }
    if (row.courseCode && !option.includes(row.courseCode)) option.push(row.courseCode);
  }

  // An incomplete mapping must not silently satisfy an empty AND option.
  for (const option of options.values()) {
    if (option.length === 0) throw new Error("Articulation option has no courses for this college");
  }
  if (requiredGroups.length === 0) throw new Error("Agreement has no required groups");
  return { ...metadata, requiredGroups, highlyRecommendedGroups };
}
