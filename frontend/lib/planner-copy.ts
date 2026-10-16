import type { RequirementGroup } from "./planner";

export function groupReviewMessage(group: RequirementGroup): string {
  const note = group.note ?? "";
  const reason = /without an explicit relationship|unclear|ambiguous/i.test(note)
    ? "The agreement does not clearly say how these course options combine."
    : /mixes admission and graduation|classify the listed courses/i.test(note)
      ? "The agreement mixes admission and degree requirements."
      : /counts a sequence|areas, or units|unit-based|sequence/i.test(note)
        ? "This group counts sequences, areas or units; course totals alone cannot verify it."
        : "This group's completion rule could not be verified.";
  return `${reason} Ask a counselor which courses you need.`;
}
