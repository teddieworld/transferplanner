import { AP_EXAMS } from "./ap-credit";
import type { APResults } from "./ap-credit";
import { getAPMajorPolicy } from "./ap-major-policy-registry";
import type { APMajorRule } from "./ap-major-policies";
import { getPreparationStatus, isGroupSatisfied, isOptionSatisfied } from "./planner";
import type { MajorAgreement, Requirement } from "./planner";

// Only the explicit AND/OR receiving-course expressions used by the reviewed
// agreements are accepted. Unknown/nested prose cannot accidentally match.
function receivingAlternatives(name: string): string[][] {
  return name.split(" OR ").map(option => option.replace(/^\((.*)\)$/, "$1").split(" AND ").map(code => code.trim()));
}

export function applyAPMajorCredit(agreement: MajorAgreement, results: APResults, completed: string[]): MajorAgreement {
  const entered = AP_EXAMS.filter(exam => results[exam.id]);
  const policy = getAPMajorPolicy(agreement);
  const matchedExams = new Set<string>();
  const eligibleRules = (policy?.rules ?? []).filter(rule => {
    if (rule.collegeOptions && !rule.collegeOptions.some(option => isOptionSatisfied(option, completed))) return false;
    return rule.exams.every(exam => {
      const result = results[exam.id];
      // An AB subscore rule is only used when the policy explicitly allows it.
      const score = exam.subscore ? result?.abSubscore : result?.score;
      return /^[1-5]$/.test(score ?? "") && Number(score) >= exam.minimum
        && (exam.maximum === undefined || Number(score) <= exam.maximum)
        && (exam.beforeYear === undefined || (/^\d{4}$/.test(result?.examYear ?? "")
          && Number(result?.examYear) >= 1950 && Number(result?.examYear) < exam.beforeYear))
        && (!exam.subscore || /^[1-5]$/.test(result?.score ?? ""));
    });
  });
  const allRequirements = [...agreement.requiredGroups, ...agreement.majorRequiredGroups ?? [], ...agreement.highlyRecommendedGroups]
    .flatMap(group => group.requirements);
  const choices = new Map<string, APMajorRule>();
  const scoreChoice = (rule: APMajorRule) => allRequirements.reduce((score, requirement) => {
    const alternatives = receivingAlternatives(requirement.name);
    const complete = alternatives.some(option => option.length > 0 && option.every(code => rule.covers.includes(code)));
    const needed = getPreparationStatus({ ...requirement, apPreparation: undefined }, completed) !== "satisfied";
    return score + (complete ? (needed ? 1000 : 10) : alternatives.flat().some(code => rule.covers.includes(code)) ? 1 : 0);
  }, 0);
  for (const rule of eligibleRules) if (rule.choice) {
    const current = choices.get(rule.choice);
    if (!current || scoreChoice(rule) > scoreChoice(current)) choices.set(rule.choice, rule);
  }
  const rules = eligibleRules.filter(rule => !rule.choice || choices.get(rule.choice) === rule);
  let examGroups = 0;
  const mapGroups = (groups: MajorAgreement["requiredGroups"]) => groups.map(group => {
    // Clear old annotations so changing scores/majors or regenerating cannot
    // retain credit from an earlier result. No caller data is mutated.
    const clean = { ...group, requirements: group.requirements.map(req => {
      const copy = { ...req }; delete copy.apPreparation; return copy;
    }) };
    const collegeComplete = isGroupSatisfied(clean, completed);
    let usesExam = false;
    const requirements = clean.requirements.map((requirement): Requirement => {
      const alternatives = receivingAlternatives(requirement.name);
      const atoms = new Set(alternatives.flat());
      const applicable = rules.filter(rule => rule.covers.some(code => atoms.has(code)));
      if (!applicable.length) return requirement;
      const covers = new Set(applicable.filter(rule => !rule.reviewNote).flatMap(rule => rule.covers));
      const fullyCovered = alternatives.some(option => option.length > 0 && option.every(code => covers.has(code)));
      const independentCovers = new Set(applicable.filter(rule => rule.independentOfCourseMapping && !rule.reviewNote).flatMap(rule => rule.covers));
      const independentOfCourseMapping = alternatives.some(option => option.length > 0 && option.every(code => independentCovers.has(code)));
      const mappingBlocked = requirement.articulationStatus === "review_required" && !independentOfCourseMapping;
      const collegeMatched = getPreparationStatus(requirement, completed) === "satisfied";
      const capReached = policy?.maxExamGroups !== undefined && (collegeComplete || examGroups >= policy.maxExamGroups);
      const reviewNote = mappingBlocked ? "Course combinations are unverified. Confirm with a counselor."
        : capReached && !collegeMatched ? collegeComplete ? "College coursework already meets this group. AP is reserved for another prerequisite." : "The limit on exam-based prerequisites is reached. Complete college coursework here."
        : !fullyCovered ? applicable.find(rule => rule.reviewNote)?.reviewNote
          ?? "AP covers only part of this requirement. Confirm the remaining courses with a counselor."
        : undefined;
      const satisfied = fullyCovered && !capReached && !mappingBlocked;
      if (satisfied && !collegeMatched) usesExam = true;
      for (const rule of applicable) for (const exam of rule.exams) matchedExams.add(exam.id);
      const matches = applicable.map(rule => ({
        exams: rule.exams.map(exam => `AP ${AP_EXAMS.find(item => item.id === exam.id)!.name}${exam.subscore ? " AB subscore" : ""} (${exam.subscore ? results[exam.id].abSubscore : results[exam.id].score})`),
        covers: rule.covers.filter(code => atoms.has(code)), source: rule.source,
        ...(rule.collegeOptions ? { collegeCourses: rule.collegeOptions.find(option => isOptionSatisfied(option, completed)) } : {}),
        ...(rule.note ? { note: rule.note } : {}),
      })).filter((match, index, all) => all.findIndex(other => JSON.stringify(other) === JSON.stringify(match)) === index);
      return { ...requirement, apPreparation: { satisfied, matches, ...(independentOfCourseMapping ? { independentOfCourseMapping } : {}), ...(reviewNote ? { reviewNote } : {}) } };
    });
    // The Psychology cap applies across categories, not once per group/category.
    if (usesExam && !group.reviewRequired) examGroups++;
    return { ...group, requirements };
  });
  const requiredGroups = mapGroups(agreement.requiredGroups);
  const majorRequiredGroups = mapGroups(agreement.majorRequiredGroups ?? []);
  const highlyRecommendedGroups = mapGroups(agreement.highlyRecommendedGroups);
  const message = !policy
    ? "AP rules are not reviewed for this major and year. Confirm credit with the department."
    : policy.unmatchedMessage ?? (policy.rules.length === 0 ? "This major does not accept AP credit."
      : "No supported requirement matches these exams and scores. Confirm alternatives with the department.");
  return { ...agreement, requiredGroups, majorRequiredGroups, highlyRecommendedGroups,
    apPreparationReview: entered.length ? { message, ...(policy?.note ? { policyNote: policy.note } : {}), unmatchedExams: entered.filter(exam => !matchedExams.has(exam.id)).map(exam => `AP ${exam.name}${results[exam.id].score ? ` (${results[exam.id].score})` : " (score missing)"}${policy?.examMessages?.[exam.id] ? ` — ${policy.examMessages[exam.id]}` : ""}`) } : undefined };
}
